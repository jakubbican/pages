/**
 * OpenAir airspace format parser.
 * Converts OpenAir text to a GeoJSON FeatureCollection.
 */

const COLOR_MAP = {
  C: '#8A2BE2',
  D: '#FF8C00',
  CTR: '#FF4500',
  R: '#DC143C',
  Q: '#9B0D9B',
  P: '#8B0000',
  GS: '#FF69B4',
  E: '#DAA520',
  ATZ: '#00CED1',
  A: '#FF0000',
  B: '#FF6347',
  W: '#4169E1',
};

const DEFAULT_COLOR = '#888888';

const NM_TO_DEG_LAT = 1 / 60; // 1 NM = 1/60 degree latitude
const FEET_TO_METERS = 0.3048;
const FL_TO_FEET = 100;
const CIRCLE_POINTS = 64;

// ---------------------------------------------------------------------------
// Coordinate parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single coordinate component from DMS or decimal format.
 * DMS: "49:53:36 N" or "016:29:53 E"
 * Decimal: "49.776062 N" or "14.699296 E"
 * Returns signed decimal degrees (negative for S/W).
 */
function parseCoordPart(str) {
  const s = str.trim();
  const parts = s.split(/\s+/);
  if (parts.length < 2) return NaN;

  const dir = parts[parts.length - 1].toUpperCase();
  const numStr = parts.slice(0, parts.length - 1).join('');

  let value;
  if (numStr.includes(':')) {
    const [d, m, sec] = numStr.split(':').map(Number);
    value = d + (m || 0) / 60 + (sec || 0) / 3600;
  } else {
    value = parseFloat(numStr);
  }

  if (dir === 'S' || dir === 'W') value = -value;
  return value;
}

/**
 * Parse a full coordinate string into [lng, lat].
 * Accepts formats like:
 *   "49:53:36 N 016:29:53 E"
 *   "49.776062 N 14.699296 E"
 */
function parseCoord(str) {
  const s = str.trim();

  // Split on the boundary between lat and lng parts.
  // The pattern: after a direction letter (N/S) there is whitespace then digits.
  const m = s.match(/^(.+?[NS])\s+(.+?[EW])\s*$/i);
  if (!m) return null;

  const lat = parseCoordPart(m[1]);
  const lng = parseCoordPart(m[2]);

  if (isNaN(lat) || isNaN(lng)) return null;
  return [lng, lat];
}

// ---------------------------------------------------------------------------
// Altitude parsing
// ---------------------------------------------------------------------------

/**
 * Parse an altitude string and return { meters, reference }.
 * reference: 'AMSL' | 'AGL' | 'FL' | 'GND'
 * Handles: FL 95, FL95, 4 000 AMSL, 4000 AMSL, 1 000 AGL, GND, SFC, UNL, etc.
 */
function parseAltitude(str) {
  if (!str) return { meters: 0, reference: 'GND' };
  const s = str.trim().toUpperCase();

  if (s === 'GND' || s === 'SFC' || s === '0 AGL' || s === '0AGL' || s === '0') {
    return { meters: 0, reference: 'GND' };
  }
  if (s === 'UNL' || s === 'UNLIMITED') {
    return { meters: 20000, reference: 'AMSL' };
  }

  // Flight level: "FL 95", "FL95", "FL 125"
  const flMatch = s.match(/^FL\s*(\d+)/);
  if (flMatch) {
    return {
      meters: parseInt(flMatch[1], 10) * FL_TO_FEET * FEET_TO_METERS,
      reference: 'FL',
    };
  }

  // Numeric with spaces in number: "4 000 AMSL", "1 000 AGL", "3500 MSL"
  // Strip spaces within the numeric part first
  const numMatch = s.match(/^([\d\s]+?)\s*(FT\s*)?(AMSL|MSL|AGL|ASFC)?\s*$/);
  if (numMatch) {
    const val = parseInt(numMatch[1].replace(/\s/g, ''), 10);
    if (val === 0) return { meters: 0, reference: 'GND' };
    const ref = numMatch[3] || 'AMSL';
    return {
      meters: val * FEET_TO_METERS,
      reference: ref === 'AGL' || ref === 'ASFC' ? 'AGL' : 'AMSL',
    };
  }

  return { meters: 0, reference: 'GND' };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Length in degrees of 1 NM of longitude at a given latitude.
 */
function nmToLngDeg(lat) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return cosLat > 1e-10 ? NM_TO_DEG_LAT / cosLat : NM_TO_DEG_LAT;
}

/**
 * Generate circle points around a center [lng, lat] with radius in NM.
 */
function generateCircle(center, radiusNM) {
  const [cLng, cLat] = center;
  const dLat = radiusNM * NM_TO_DEG_LAT;
  const dLng = radiusNM * nmToLngDeg(cLat);
  const coords = [];

  for (let i = 0; i <= CIRCLE_POINTS; i++) {
    const angle = (2 * Math.PI * i) / CIRCLE_POINTS;
    coords.push([
      cLng + dLng * Math.cos(angle),
      cLat + dLat * Math.sin(angle),
    ]);
  }
  return coords;
}

/**
 * Compute the bearing (in radians, 0 = east, counter-clockwise positive)
 * from center to a point, both as [lng, lat].
 */
function bearingFromCenter(center, point) {
  const [cLng, cLat] = center;
  const [pLng, pLat] = point;
  const dLat = pLat - cLat;
  const dLng = (pLng - cLng) * Math.cos((cLat * Math.PI) / 180);
  return Math.atan2(dLat, dLng);
}

/**
 * Approximate radius in NM from center to point.
 */
function distanceNM(center, point) {
  const [cLng, cLat] = center;
  const [pLng, pLat] = point;
  const dLat = (pLat - cLat) * 60; // degrees to NM
  const dLng = (pLng - cLng) * Math.cos((cLat * Math.PI) / 180) * 60;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Generate arc points from startPoint to endPoint around center.
 * direction: '+' for clockwise, '-' for counter-clockwise.
 * Returns array of [lng, lat] points (not including the start, includes end).
 */
function generateArc(center, startPoint, endPoint, direction) {
  const [cLng, cLat] = center;
  const radius = distanceNM(center, startPoint);

  let startAngle = bearingFromCenter(center, startPoint);
  let endAngle = bearingFromCenter(center, endPoint);

  // '+' means clockwise in geographic terms.
  // In our math coordinate system (east=0, CCW positive),
  // clockwise means decreasing angle.
  const clockwise = direction === '+';

  if (clockwise) {
    // We need to go from startAngle decreasing to endAngle
    if (endAngle >= startAngle) endAngle -= 2 * Math.PI;
  } else {
    // Counter-clockwise: increasing angle
    if (endAngle <= startAngle) endAngle += 2 * Math.PI;
  }

  const totalAngle = endAngle - startAngle;
  // Use enough steps for a smooth arc
  const steps = Math.max(8, Math.round(Math.abs(totalAngle) / (2 * Math.PI) * CIRCLE_POINTS));

  const dLat = radius * NM_TO_DEG_LAT;
  const dLng = radius * nmToLngDeg(cLat);
  const points = [];

  for (let i = 1; i <= steps; i++) {
    const angle = startAngle + (totalAngle * i) / steps;
    points.push([
      cLng + dLng * Math.cos(angle),
      cLat + dLat * Math.sin(angle),
    ]);
  }

  return points;
}

// ---------------------------------------------------------------------------
// Color from SP tag
// ---------------------------------------------------------------------------

/**
 * Parse SP tag value "style,width,R,G,B" and return a hex color string.
 */
function parseSPColor(value) {
  const parts = value.split(',').map(s => s.trim());
  if (parts.length >= 5) {
    const r = parseInt(parts[2], 10);
    const g = parseInt(parts[3], 10);
    const b = parseInt(parts[4], 10);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const hex = (v) => v.toString(16).padStart(2, '0');
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Effective class resolution
// ---------------------------------------------------------------------------

/**
 * Determine effective class: AC D + AY CTR -> CTR
 */
function effectiveClass(acClass, ayType) {
  if (acClass === 'D' && ayType === 'CTR') return 'CTR';
  return acClass || 'default';
}

// ---------------------------------------------------------------------------
// Label builder
// ---------------------------------------------------------------------------

function buildLabel(name, upperStr, lowerStr) {
  const parts = [];
  if (name) parts.push(name);
  if (upperStr || lowerStr) {
    parts.push(`${upperStr || '?'} / ${lowerStr || '?'}`);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Strip inline comments from a V-line value
// ---------------------------------------------------------------------------

function stripInlineComment(value) {
  // Comments start with * outside of coordinate data.
  // Coordinates use letters N/S/E/W — find the last direction letter
  // and strip everything after the next *.
  const idx = value.indexOf('*');
  if (idx !== -1) {
    return value.substring(0, idx).trim();
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse OpenAir format text and return a GeoJSON FeatureCollection.
 * @param {string} text - OpenAir format content
 * @returns {object} GeoJSON FeatureCollection
 */
export function parseOpenAir(text) {
  const features = [];
  const lines = text.split(/\r?\n/);

  // Current airspace state
  let acClass = null;
  let ayType = null;
  let name = null;
  let upperAltStr = null;
  let lowerAltStr = null;
  let frequency = null;
  let station = null;
  let spColor = null;
  let coords = [];
  let center = null;
  let arcDir = '+'; // default clockwise
  let featureId = 0;

  function flushAirspace() {
    if (acClass === null) return;
    if (coords.length === 0) return;

    // Close polygon if not already closed
    if (coords.length > 1) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([first[0], first[1]]);
      }
    }

    const ec = effectiveClass(acClass, ayType);
    const color = spColor || COLOR_MAP[ec] || DEFAULT_COLOR;
    const upper = parseAltitude(upperAltStr);
    const lower = parseAltitude(lowerAltStr);

    featureId++;
    features.push({
      type: 'Feature',
      properties: {
        id: featureId,
        class: ec,
        type: ayType || null,
        name: name || null,
        frequency: frequency || null,
        station: station || null,
        upperAlt: upper.meters,
        lowerAlt: lower.meters,
        upperRef: upper.reference,
        lowerRef: lower.reference,
        upperAltStr: upperAltStr || null,
        lowerAltStr: lowerAltStr || null,
        color,
        label: buildLabel(name, upperAltStr, lowerAltStr),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    });
  }

  function resetState() {
    acClass = null;
    ayType = null;
    name = null;
    upperAltStr = null;
    lowerAltStr = null;
    frequency = null;
    station = null;
    spColor = null;
    coords = [];
    center = null;
    arcDir = '+';
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comment-only lines
    if (!line || line.startsWith('*')) continue;

    // Parse tag and value.
    // Most tags are 2 chars, but V lines need special handling.
    let tag, value;

    if (/^V\s/i.test(line)) {
      // V line: "V X=...", "V D=+", etc.
      tag = 'V';
      value = line.substring(1).trim();
    } else {
      // Standard 2-char tags: AC, AY, AN, AH, AL, AF, AG, SP, DP, DC, DB
      const m = line.match(/^([A-Z]{2})\s+(.*)/i);
      if (!m) continue;
      tag = m[1].toUpperCase();
      value = m[2].trim();
    }

    switch (tag) {
      case 'AC': {
        // New airspace block — flush the previous one
        flushAirspace();
        resetState();
        acClass = value.trim();
        break;
      }

      case 'AY':
        ayType = value.trim();
        break;

      case 'AN':
        name = value.trim();
        break;

      case 'AH':
        upperAltStr = value.trim();
        break;

      case 'AL':
        lowerAltStr = value.trim();
        break;

      case 'AF':
        frequency = value.trim();
        break;

      case 'AG':
        station = value.trim();
        break;

      case 'SP': {
        const c = parseSPColor(value);
        if (c) spColor = c;
        break;
      }

      case 'DP': {
        const pt = parseCoord(value);
        if (pt) coords.push(pt);
        break;
      }

      case 'DC': {
        // Circle: value is radius in NM, uses current center
        const radius = parseFloat(value);
        if (!isNaN(radius) && center) {
          coords = generateCircle(center, radius);
        }
        break;
      }

      case 'DB': {
        // Arc between two points: "lat1 lng1, lat2 lng2"
        const arcParts = value.split(',');
        if (arcParts.length === 2 && center) {
          const p1 = parseCoord(arcParts[0].trim());
          const p2 = parseCoord(arcParts[1].trim());
          if (p1 && p2) {
            // If coords is empty, add the start point
            if (coords.length === 0) {
              coords.push(p1);
            }
            const arcPoints = generateArc(center, p1, p2, arcDir);
            coords.push(...arcPoints);
          }
        }
        break;
      }

      case 'V': {
        // Variable assignment: "X=coord" or "D=+/-"
        // Value at this point is everything after "V " (trimmed).
        if (/^X\s*=/i.test(value)) {
          const coordStr = stripInlineComment(value.replace(/^X\s*=\s*/i, ''));
          const pt = parseCoord(coordStr);
          if (pt) center = pt;
        } else if (/^D\s*=/i.test(value)) {
          const dirVal = value.replace(/^D\s*=\s*/i, '').trim();
          if (dirVal === '-') {
            arcDir = '-';
          } else {
            arcDir = '+';
          }
        }
        break;
      }

      // Ignore unknown tags
      default:
        break;
    }
  }

  // Flush the last airspace block
  flushAirspace();

  return {
    type: 'FeatureCollection',
    features,
  };
}
