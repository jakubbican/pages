// js/airspace-layers.js
// Manages airspace fill-extrusion layers on the map

const CLASS_ORDER = ['P', 'R', 'Q', 'C', 'D', 'CTR', 'E', 'ATZ', 'GS', 'W', 'A', 'B'];
const SOURCE_ID = 'airspace-source';

let currentOpacity = 0.4;
let currentAltMax = 20000;
let hiddenClasses = new Set();

export function getClassCounts(geojson) {
  const counts = {};
  for (const f of geojson.features) {
    const cls = f.properties.class;
    counts[cls] = (counts[cls] || 0) + 1;
  }
  return counts;
}

export function addAirspaceLayers(map, geojson) {
  // Remove existing first
  removeAirspaceLayers(map);

  // Add source
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geojson,
    generateId: true,
  });

  // Find label layer to insert before (so labels stay on top)
  const labelLayer = findLabelLayer(map);

  const classesInData = [...new Set(geojson.features.map(f => f.properties.class))];

  for (const cls of CLASS_ORDER) {
    if (!classesInData.includes(cls)) continue;

    const layerId = `airspace-fill-${cls}`;

    map.addLayer({
      id: layerId,
      type: 'fill-extrusion',
      source: SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'class'], cls],
        ['<=', ['get', 'upperAlt'], currentAltMax],
      ],
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'upperAlt'],
        'fill-extrusion-base': ['get', 'lowerAlt'],
        'fill-extrusion-opacity': currentOpacity,
      },
      layout: {
        visibility: hiddenClasses.has(cls) ? 'none' : 'visible',
      },
    }, labelLayer);

    // Outline layer for airspace borders
    const outlineId = `airspace-outline-${cls}`;
    map.addLayer({
      id: outlineId,
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

  // Setup click and hover handlers
  setupClickHandler(map, classesInData);
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
  const style = map.getStyle();
  if (!style) return;

  for (const layer of style.layers) {
    if (layer.id.startsWith('airspace-fill-') || layer.id.startsWith('airspace-outline-')) {
      const cls = layer.id.replace('airspace-fill-', '').replace('airspace-outline-', '');
      map.setFilter(layer.id, [
        'all',
        ['==', ['get', 'class'], cls],
        ['<=', ['get', 'upperAlt'], maxAlt],
      ]);
    }
  }
}

export function toggleClassVisibility(map, cls, visible) {
  if (visible) {
    hiddenClasses.delete(cls);
  } else {
    hiddenClasses.add(cls);
  }

  const vis = visible ? 'visible' : 'none';
  const fillId = `airspace-fill-${cls}`;
  const outlineId = `airspace-outline-${cls}`;

  if (map.getLayer(fillId)) map.setLayoutProperty(fillId, 'visibility', vis);
  if (map.getLayer(outlineId)) map.setLayoutProperty(outlineId, 'visibility', vis);
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

function setupClickHandler(map, classesInData) {
  const layerIds = classesInData
    .filter(cls => CLASS_ORDER.includes(cls))
    .map(cls => `airspace-fill-${cls}`);

  for (const layerId of layerIds) {
    if (!map.getLayer(layerId)) continue;

    map.on('click', layerId, (e) => {
      if (!e.features || !e.features.length) return;
      e.originalEvent.stopPropagation();
      const f = e.features[0];
      showInfoPanel(f.properties);
    });

    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  // Close info panel when clicking outside airspace
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: layerIds.filter(id => map.getLayer(id)),
    });
    if (!features.length) {
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

  const upperM = Math.round(props.upperAlt);
  const lowerM = Math.round(props.lowerAlt);
  const upperFt = Math.round(props.upperAlt / 0.3048);
  const lowerFt = Math.round(props.lowerAlt / 0.3048);
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

// Close button handler
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('info-close')?.addEventListener('click', () => {
    const panel = document.getElementById('info-panel');
    panel.style.display = 'none';
    panel.classList.remove('visible');
  });
});
