// js/app.js — Main application entry point
import { parseOpenAir } from './openair-parser.js';
import {
  addAirspaceLayers,
  removeAirspaceLayers,
  updateOpacity,
  updateAltitudeFilter,
  toggleClassVisibility,
  getClassCounts,
} from './airspace-layers.js';
import { setupControls } from './ui-controls.js';
import { flyPragueToBrno, flyCzechOverview } from './flythrough.js';

// ---- Config ----
const API_KEY = 'QH0ujAII1roXcV8Z4Pke';
maptilersdk.config.apiKey = API_KEY;

// MapTiler V4 styles
const STYLES = {
  'DATAVIZ.DARK': maptilersdk.MapStyle.DATAVIZ.DARK,
  'STREETS':      maptilersdk.MapStyle.STREETS,
  'SATELLITE':    maptilersdk.MapStyle.SATELLITE,
  'OUTDOOR':      maptilersdk.MapStyle.OUTDOOR,
  'TOPO':         maptilersdk.MapStyle.TOPO,
};

// ---- Map initialization ----
const map = new maptilersdk.Map({
  container: 'map',
  style: maptilersdk.MapStyle.DATAVIZ.DARK,
  center: [15.5, 49.8],
  zoom: 7.5,
  pitch: 55,
  bearing: 0,
  terrain: true,
  terrainExaggeration: 1.0,
  terrainControl: true,
  navigationControl: 'top-right',
  hash: true,
});

// ---- Geocoding control ----
try {
  const gc = new maptilersdkMaptilerGeocoder.GeocodingControl({
    country: ['cz'],
    proximity: [15.5, 49.8],
  });
  map.addControl(gc, 'top-left');
} catch (e) {
  console.warn('Geocoding control not available:', e.message);
}

// ---- State ----
let geojsonData = null;
let currentStyle = 'DATAVIZ.DARK';

// ---- Data loading ----
async function loadData() {
  const [allResp, atzResp] = await Promise.all([
    fetch('data/CZ_all.txt'),
    fetch('data/CZ_atz.txt'),
  ]);
  const [allText, atzText] = await Promise.all([
    allResp.text(),
    atzResp.text(),
  ]);

  const allData = parseOpenAir(allText);
  const atzData = parseOpenAir(atzText);

  // Merge with unique IDs
  return {
    type: 'FeatureCollection',
    features: [...allData.features, ...atzData.features].map((f, i) => ({
      ...f,
      properties: { ...f.properties, id: i },
    })),
  };
}

// ---- Main init on map load ----
map.on('load', async () => {
  try {
    geojsonData = await loadData();
    console.log(`Loaded ${geojsonData.features.length} airspace features`);

    addAirspaceLayers(map, geojsonData);

    const classCounts = getClassCounts(geojsonData);
    setupControls(map, geojsonData, classCounts, {
      onOpacityChange: (val) => updateOpacity(map, val / 100),
      onAltitudeChange: (val) => updateAltitudeFilter(map, val),
      onClassToggle: (cls, visible) => toggleClassVisibility(map, cls, visible),
      onFlythrough: () => flyPragueToBrno(map),
      onOverview: () => flyCzechOverview(map),
    });

    // Hide loading
    document.getElementById('loading').classList.add('hidden');
  } catch (err) {
    console.error('Failed to load airspace data:', err);
    document.getElementById('loading').innerHTML =
      '<p style="color:#f87171">Error loading data. Check console.</p>';
  }
});

// ---- Style switching ----
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const styleName = btn.dataset.style;
    if (styleName === currentStyle) return;

    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStyle = styleName;

    map.setStyle(STYLES[styleName]);
    // Re-add layers once new style data arrives (MapTiler recommended pattern)
    map.once('styledata', () => {
      if (geojsonData) {
        // Small delay to ensure style internals are ready
        setTimeout(() => {
          addAirspaceLayers(map, geojsonData);
        }, 300);
      }
    });
  });
});

// ---- Expose for Playwright testing ----
window.__map = map;
window.__geojsonData = () => geojsonData;
