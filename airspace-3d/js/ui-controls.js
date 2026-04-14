// js/ui-controls.js
// Legend, sliders, panel toggling

const CLASS_COLORS = {
  'C': '#8A2BE2', 'D': '#FF8C00', 'CTR': '#FF4500',
  'R': '#DC143C', 'Q': '#9B0D9B', 'P': '#8B0000',
  'GS': '#FF69B4', 'E': '#DAA520', 'ATZ': '#00CED1',
  'A': '#FF0000', 'B': '#FF6347', 'W': '#4169E1',
};

const CLASS_LABELS = {
  'C': 'Class C', 'D': 'Class D / TMA', 'CTR': 'CTR',
  'R': 'Restricted / TRA / TSA', 'Q': 'Danger / Dropzone',
  'P': 'Prohibited', 'GS': 'Glider Sector',
  'E': 'Class E / RMZ', 'ATZ': 'ATZ',
  'A': 'Class A', 'B': 'Class B', 'W': 'Wave',
};

const CLASS_ORDER = ['P', 'CTR', 'C', 'D', 'R', 'Q', 'E', 'ATZ', 'GS', 'W'];

export function setupControls(map, geojson, classCounts, callbacks) {
  buildLegend(classCounts, callbacks);
  wireSliders(map, callbacks);
  wireFlythroughButtons(callbacks);
  wirePanelToggles();
}

function buildLegend(classCounts, callbacks) {
  const legendContent = document.getElementById('legend-content');
  legendContent.innerHTML = '';

  for (const cls of CLASS_ORDER) {
    if (!classCounts[cls]) continue;

    const row = document.createElement('div');
    row.className = 'legend-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.className = 'legend-checkbox';
    checkbox.dataset.cls = cls;

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = CLASS_COLORS[cls] || '#888';

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = CLASS_LABELS[cls] || cls;

    const count = document.createElement('span');
    count.className = 'legend-count';
    count.textContent = classCounts[cls];

    row.appendChild(checkbox);
    row.appendChild(swatch);
    row.appendChild(label);
    row.appendChild(count);
    legendContent.appendChild(row);

    checkbox.addEventListener('change', () => {
      callbacks.onClassToggle(cls, checkbox.checked);
    });
  }
}

function wireSliders(map, callbacks) {
  // Opacity
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityValue = document.getElementById('opacity-value');
  opacitySlider.addEventListener('input', () => {
    const val = parseInt(opacitySlider.value);
    opacityValue.textContent = val + '%';
    callbacks.onOpacityChange(val);
  });

  // Altitude (slider in feet, convert to meters for filter)
  const altSlider = document.getElementById('altitude-slider');
  const altValue = document.getElementById('altitude-value');
  altSlider.addEventListener('input', () => {
    const ft = parseInt(altSlider.value);
    if (ft >= 66000) {
      altValue.textContent = '\u221E';
    } else if (ft >= 10000) {
      altValue.textContent = 'FL ' + Math.round(ft / 100);
    } else {
      altValue.textContent = ft + ' ft';
    }
    const meters = ft * 0.3048;
    callbacks.onAltitudeChange(meters);
  });

  // Terrain exaggeration — also scales airspace extrusion heights
  const terrainSlider = document.getElementById('terrain-slider');
  const terrainValue = document.getElementById('terrain-value');
  terrainSlider.addEventListener('input', () => {
    const val = parseFloat(terrainSlider.value);
    terrainValue.textContent = val.toFixed(1) + 'x';
    if (val > 0) {
      map.enableTerrain(val);
    } else {
      map.disableTerrain();
    }
    // Keep airspace volume heights in sync with terrain exaggeration
    callbacks.onExaggerationChange(Math.max(val, 1));
  });
}

function wireFlythroughButtons(callbacks) {
  document.getElementById('flythrough-btn').addEventListener('click', callbacks.onFlythrough);
  document.getElementById('flythrough-overview-btn').addEventListener('click', callbacks.onOverview);
}

function wirePanelToggles() {
  document.querySelectorAll('.panel-header[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const panel = header.closest('.panel');
      if (!panel) return;
      panel.classList.toggle('collapsed');
      const icon = header.querySelector('.toggle-icon');
      if (icon) {
        icon.textContent = panel.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
      }
    });
  });
}
