// js/airspace-layers.js
// Manages airspace fill-extrusion + outline layers
// Performance: NO mouseenter/mouseleave (avoids continuous 3D raycasting)

const CLASS_ORDER = ['P', 'R', 'Q', 'C', 'D', 'CTR', 'E', 'ATZ', 'GS', 'W', 'A', 'B'];
const SOURCE_ID = 'airspace-source';

let currentOpacity = 0.4;
let currentAltMax = 20000;
let currentExaggeration = 1.0;
let hiddenClasses = new Set();
let clickHandlerBound = false;

export function getClassCounts(geojson) {
  const counts = {};
  for (const f of geojson.features) {
    const cls = f.properties.class;
    counts[cls] = (counts[cls] || 0) + 1;
  }
  return counts;
}

export function addAirspaceLayers(map, geojson) {
  removeAirspaceLayers(map);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  const labelLayer = findLabelLayer(map);
  const classesInData = [...new Set(geojson.features.map(f => f.properties.class))];

  for (const cls of CLASS_ORDER) {
    if (!classesInData.includes(cls)) continue;

    // Fill-extrusion layer
    map.addLayer({
      id: `airspace-fill-${cls}`,
      type: 'fill-extrusion',
      source: SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'class'], cls],
        ['<=', ['get', 'upperAlt'], currentAltMax],
      ],
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['*', ['get', 'upperAlt'], currentExaggeration],
        'fill-extrusion-base': ['*', ['get', 'lowerAlt'], currentExaggeration],
        'fill-extrusion-opacity': currentOpacity,
      },
      layout: {
        visibility: hiddenClasses.has(cls) ? 'none' : 'visible',
      },
    }, labelLayer);

    // Outline layer
    map.addLayer({
      id: `airspace-outline-${cls}`,
      type: 'line',
      source: SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'class'], cls],
        ['<=', ['get', 'upperAlt'], currentAltMax],
      ],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.7,
      },
      layout: {
        visibility: hiddenClasses.has(cls) ? 'none' : 'visible',
      },
    }, labelLayer);
  }

  // Bind click handler only once (survives style changes)
  if (!clickHandlerBound) {
    setupClickHandler(map);
    clickHandlerBound = true;
  }
}

export function removeAirspaceLayers(map) {
  const style = map.getStyle();
  if (!style || !style.layers) return;

  const toRemove = style.layers.filter(l => l.id.startsWith('airspace-')).map(l => l.id);
  for (const id of toRemove) {
    map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID);
  }
}

export function updateOpacity(map, opacity) {
  currentOpacity = opacity;
  const style = map.getStyle();
  if (!style) return;
  for (const layer of style.layers) {
    if (layer.id.startsWith('airspace-fill-')) {
      map.setPaintProperty(layer.id, 'fill-extrusion-opacity', opacity);
    }
  }
}

export function updateAltitudeFilter(map, maxAlt) {
  currentAltMax = maxAlt;
  applyFilters(map);
}

function applyFilters(map) {
  const style = map.getStyle();
  if (!style) return;
  for (const layer of style.layers) {
    if (layer.id.startsWith('airspace-fill-') || layer.id.startsWith('airspace-outline-')) {
      const cls = layer.id.replace('airspace-fill-', '').replace('airspace-outline-', '');
      map.setFilter(layer.id, [
        'all',
        ['==', ['get', 'class'], cls],
        ['<=', ['get', 'upperAlt'], currentAltMax],
      ]);
    }
  }
}

export function updateExaggeration(map, exaggeration) {
  currentExaggeration = exaggeration;
  const style = map.getStyle();
  if (!style) return;
  for (const layer of style.layers) {
    if (layer.id.startsWith('airspace-fill-')) {
      map.setPaintProperty(layer.id, 'fill-extrusion-height',
        ['*', ['get', 'upperAlt'], exaggeration]);
      map.setPaintProperty(layer.id, 'fill-extrusion-base',
        ['*', ['get', 'lowerAlt'], exaggeration]);
    }
  }
  applyFilters(map);
}

export function toggleClassVisibility(map, cls, visible) {
  if (visible) {
    hiddenClasses.delete(cls);
  } else {
    hiddenClasses.add(cls);
  }
  const vis = visible ? 'visible' : 'none';
  if (map.getLayer(`airspace-fill-${cls}`))
    map.setLayoutProperty(`airspace-fill-${cls}`, 'visibility', vis);
  if (map.getLayer(`airspace-outline-${cls}`))
    map.setLayoutProperty(`airspace-outline-${cls}`, 'visibility', vis);
}

function findLabelLayer(map) {
  const layers = map.getStyle().layers;
  for (const l of layers) {
    if (l.type === 'symbol' && (l.id.includes('label') || l.id.includes('place') || l.id.includes('poi'))) {
      return l.id;
    }
  }
  return undefined;
}

// Click-only interaction — NO mouseenter/mouseleave (those cause constant GPU raycasting)
function setupClickHandler(map) {
  map.on('click', (e) => {
    // Query all airspace fill layers at click point
    const fillLayers = (map.getStyle()?.layers || [])
      .filter(l => l.id.startsWith('airspace-fill-'))
      .map(l => l.id);

    if (!fillLayers.length) return;

    const features = map.queryRenderedFeatures(e.point, { layers: fillLayers });

    if (features.length > 0) {
      showInfoPanel(features[0].properties);
    } else {
      const panel = document.getElementById('info-panel');
      panel.style.display = 'none';
      panel.classList.remove('visible');
    }
  });
}

function showInfoPanel(props) {
  const panel = document.getElementById('info-panel');
  const nameEl = document.getElementById('info-name');
  const contentEl = document.getElementById('info-content');

  nameEl.textContent = props.name || 'Unknown';
  nameEl.style.color = props.color;

  const upperRefBadge = props.upperRef ? ` <small class="ref-badge">${props.upperRef}</small>` : '';
  const lowerRefBadge = props.lowerRef ? ` <small class="ref-badge">${props.lowerRef}</small>` : '';

  contentEl.innerHTML = `
    <div class="info-row">
      <span class="info-label">Class</span>
      <span class="info-value" style="color:${props.color}">${props.label || props.class}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Type</span>
      <span class="info-value">${props.type || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Upper</span>
      <span class="info-value">${props.upperAltStr || '—'}${upperRefBadge}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Lower</span>
      <span class="info-value">${props.lowerAltStr || '—'}${lowerRefBadge}</span>
    </div>
    ${props.frequency ? `
    <div class="info-row">
      <span class="info-label">Freq</span>
      <span class="info-value">${props.frequency} MHz</span>
    </div>` : ''}
    ${props.station ? `
    <div class="info-row">
      <span class="info-label">Station</span>
      <span class="info-value">${props.station}</span>
    </div>` : ''}
  `;

  panel.style.display = 'block';
  panel.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('info-close')?.addEventListener('click', () => {
    const panel = document.getElementById('info-panel');
    panel.style.display = 'none';
    panel.classList.remove('visible');
  });
});
