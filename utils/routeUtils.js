const https = require("https");
const http = require("http");

const OSRM_BASE = process.env.OSRM_BASE || "https://router.project-osrm.org";

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const fetchOsrmRoute = (fromLng, fromLat, toLng, toLat) =>
  new Promise((resolve, reject) => {
    const url = `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
    const client = url.startsWith("https") ? https : http;

    client.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.code !== "Ok" || !parsed.routes?.length) {
            resolve(null);
            return;
          }
          const route = parsed.routes[0];
          resolve({
            distanceKm: Math.round((route.distance / 1000) * 100) / 100,
            durationMin: Math.round((route.duration / 60) * 100) / 100,
            coordinates: route.geometry.coordinates.map((c) => [c[1], c[0]]),
          });
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });

const estimateEta = (distanceKm, averageSpeedKmph = 60) => {
  const hours = distanceKm / averageSpeedKmph;
  return Math.round(hours * 60);
};

const cleanAddress = (query) => {
  return query
    .replace(/\bCnr\b[^,]*/gi, '')
    .replace(/\s*&\s*,?\s*/g, ', ')
    .replace(/,+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ', ')
    .replace(/^[, ]+|[, ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getFallbackQueries = (query) => {
  const parts = query.split(',').map(s => s.trim()).filter(Boolean);
  const fallbacks = [];
  if (parts.length >= 2) fallbacks.push(parts.slice(-2).join(', '));
  if (parts.length >= 1) fallbacks.push(parts[parts.length - 1]);
  return fallbacks;
};

const geocodeNominatim = async (query) => {
  if (!query) return null;
  const tryGeocode = async (q) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "TMS/1.0" } });
      const data = await res.json();
      if (!data?.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
    } catch {
      return null;
    }
  };

  const cleaned = cleanAddress(query);
  let result = await tryGeocode(cleaned);
  if (result) return result;

  const fallbacks = getFallbackQueries(cleaned);
  for (const fb of fallbacks) {
    result = await tryGeocode(fb);
    if (result) return result;
  }

  return null;
};

const fetchOsrmTrip = (waypoints) =>
  new Promise((resolve, reject) => {
    if (!waypoints || waypoints.length < 2) {
      resolve(null);
      return;
    }
    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
    const url = `${OSRM_BASE}/trip/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&source=first&destination=last`;
    const client = url.startsWith("https") ? https : http;

    client.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.code !== "Ok" || !parsed.trips?.length) {
            resolve(null);
            return;
          }
          const trip = parsed.trips[0];
          const wayOrder = parsed.waypoints.map((wp) => wp.waypoint_index);
          resolve({
            distanceKm: Math.round((trip.distance / 1000) * 100) / 100,
            durationMin: Math.round((trip.duration / 60) * 100) / 100,
            coordinates: trip.geometry.coordinates.map((c) => [c[1], c[0]]),
            wayOrder,
          });
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });

module.exports = { haversineDistance, fetchOsrmRoute, fetchOsrmTrip, estimateEta, geocodeNominatim };
