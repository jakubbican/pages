/**
 * Cinematic flythrough camera animations for MapTiler SDK map.
 *
 * Exports two async functions that animate the camera along predefined
 * waypoints using map.flyTo() with chained awaits.
 */

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Wraps map.flyTo() in a Promise that resolves on 'moveend'.
 * @param {object} map  - MapTiler SDK map instance
 * @param {object} options - flyTo options (center, zoom, pitch, bearing, duration, …)
 * @returns {Promise<void>}
 */
function flyToAsync(map, options) {
  return new Promise(resolve => {
    map.once('moveend', resolve);
    map.flyTo({ essential: true, ...options });
  });
}

// ---------------------------------------------------------------------------
// Prague -> Brno cinematic flight
// ---------------------------------------------------------------------------

/**
 * Cinematic flight from Prague Ruzyne airport to Brno.
 * Disables `#flythrough-btn` during the animation.
 *
 * @param {object} map - MapTiler SDK map instance
 */
export async function flyPragueToBrno(map) {
  const btn = document.getElementById('flythrough-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Flying...';
  }

  try {
    // 1 — Prague Ruzyne departure
    await flyToAsync(map, {
      center: [14.26, 50.10],
      zoom: 12,
      pitch: 65,
      bearing: 140,
      duration: 3000,
    });

    // 2 — Climb out SE
    await flyToAsync(map, {
      center: [14.45, 50.00],
      zoom: 10.5,
      pitch: 60,
      bearing: 150,
      duration: 4000,
    });

    // 3 — Over Benesov
    await flyToAsync(map, {
      center: [14.70, 49.80],
      zoom: 10,
      pitch: 55,
      bearing: 155,
      duration: 4000,
    });

    // 4 — Jihlava highlands
    await flyToAsync(map, {
      center: [15.30, 49.55],
      zoom: 9.5,
      pitch: 50,
      bearing: 150,
      duration: 5000,
    });

    // 5 — Highlands panorama
    await flyToAsync(map, {
      center: [15.80, 49.40],
      zoom: 9,
      pitch: 45,
      bearing: 140,
      duration: 4000,
    });

    // 6 — Descending to Brno
    await flyToAsync(map, {
      center: [16.40, 49.25],
      zoom: 10,
      pitch: 55,
      bearing: 130,
      duration: 4000,
    });

    // 7 — Brno arrival
    await flyToAsync(map, {
      center: [16.69, 49.15],
      zoom: 12,
      pitch: 65,
      bearing: 120,
      duration: 3000,
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Prague → Brno';
    }
  }
}

// ---------------------------------------------------------------------------
// Czech airspace overview tour
// ---------------------------------------------------------------------------

/**
 * Overview tour of Czech airspace.
 * Disables `#flythrough-overview-btn` during the animation.
 *
 * @param {object} map - MapTiler SDK map instance
 */
export async function flyCzechOverview(map) {
  const btn = document.getElementById('flythrough-overview-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Flying...';
  }

  try {
    // 1 — High overview
    await flyToAsync(map, {
      center: [15.5, 49.8],
      zoom: 7,
      pitch: 0,
      bearing: 0,
      duration: 2000,
    });

    // 2 — Tilt to 3D
    await flyToAsync(map, {
      center: [15.5, 49.8],
      zoom: 7.5,
      pitch: 55,
      bearing: -30,
      duration: 3000,
    });

    // 3 — Slow rotation
    await flyToAsync(map, {
      center: [15.5, 49.8],
      zoom: 7.5,
      pitch: 55,
      bearing: 30,
      duration: 5000,
    });

    // 4 — Zoom to Prague TMA
    await flyToAsync(map, {
      center: [14.4, 50.1],
      zoom: 9.5,
      pitch: 60,
      bearing: 20,
      duration: 4000,
    });

    // 5 — Back to overview
    await flyToAsync(map, {
      center: [15.5, 49.8],
      zoom: 7.5,
      pitch: 55,
      bearing: 60,
      duration: 4000,
    });

    // 6 — Show Ostrava
    await flyToAsync(map, {
      center: [18.15, 49.83],
      zoom: 9.5,
      pitch: 60,
      bearing: -20,
      duration: 4000,
    });

    // 7 — Final overview
    await flyToAsync(map, {
      center: [15.5, 49.8],
      zoom: 7.5,
      pitch: 45,
      bearing: 0,
      duration: 3000,
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'CZ Overview';
    }
  }
}
