const Load = require("../models/Load");
const { haversineDistance, fetchOsrmRoute, fetchOsrmTrip, estimateEta, geocodeNominatim } = require("../utils/routeUtils");
const { logAction } = require("../utils/auditLogger");

exports.geocode = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: "Query parameter 'q' is required" });

    const result = await geocodeNominatim(q);
    if (!result) return res.status(404).json({ message: "Location not found" });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.calculateRoute = async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng, loadId } = req.body;

    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return res.status(400).json({ message: "fromLat, fromLng, toLat, toLng are required" });
    }

    const straightLine = haversineDistance(fromLat, fromLng, toLat, toLng);

    const osrm = await fetchOsrmRoute(fromLng, fromLat, toLng, toLat);

    const result = {
      straightLineKm: Math.round(straightLine * 100) / 100,
      roadDistanceKm: osrm?.distanceKm || null,
      durationMin: osrm?.durationMin || estimateEta(straightLine),
      coordinates: osrm?.coordinates || null,
    };

    if (loadId) {
      const load = await Load.findById(loadId);
      if (load) {
        load.routeDistance = result.roadDistanceKm || result.straightLineKm;
        load.routeDuration = result.durationMin;
        load.routePolyline = result.coordinates ? JSON.stringify(result.coordinates) : undefined;
        if (fromLat != null) { load.pickupLat = fromLat; load.pickupLng = fromLng; }
        if (toLat != null) { load.deliveryLat = toLat; load.deliveryLng = toLng; }
        await load.save();

        await logAction({
          action: "updated", entity: "Load", entityId: load._id, req,
          details: `Route calculated for load ${load.ticketNumber}: ${result.roadDistanceKm || result.straightLineKm}km, ${result.durationMin}min`,
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.calculateMultiStopRoute = async (req, res) => {
  try {
    const { stops, loadId } = req.body;
    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ message: "At least 2 stops are required" });
    }

    const waypoints = stops.map((s) => ({
      lat: s.lat,
      lng: s.lng,
    }));

    const osrm = await fetchOsrmTrip(waypoints);
    if (!osrm) {
      const straightLine = haversineDistance(stops[0].lat, stops[0].lng, stops[stops.length - 1].lat, stops[stops.length - 1].lng);
      return res.json({
        roadDistanceKm: null,
        durationMin: estimateEta(straightLine),
        coordinates: null,
        wayOrder: null,
        straightLineKm: Math.round(straightLine * 100) / 100,
      });
    }

    const result = {
      roadDistanceKm: osrm.distanceKm,
      durationMin: osrm.durationMin,
      coordinates: osrm.coordinates,
      wayOrder: osrm.wayOrder,
    };

    if (loadId) {
      const load = await Load.findById(loadId);
      if (load) {
        load.routeDistance = result.roadDistanceKm;
        load.routeDuration = result.durationMin;
        load.routePolyline = result.coordinates ? JSON.stringify(result.coordinates) : undefined;

        if (result.wayOrder && stops.length > 0) {
          const reordered = result.wayOrder.map((idx) => ({
            location: stops[idx].location || "",
            lat: stops[idx].lat,
            lng: stops[idx].lng,
            type: stops[idx].type || "waypoint",
            sequence: idx,
          }));
          load.stops = reordered;
          if (reordered.length > 0) {
            load.pickupLocation = reordered[0].location;
            load.pickupLat = reordered[0].lat;
            load.pickupLng = reordered[0].lng;
            const last = reordered[reordered.length - 1];
            load.deliveryLocation = last.location;
            load.deliveryLat = last.lat;
            load.deliveryLng = last.lng;
          }
        }

        await load.save();

        await logAction({
          action: "updated", entity: "Load", entityId: load._id, req,
          details: `Multi-stop route calculated for load ${load.ticketNumber}: ${result.roadDistanceKm}km`,
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.batchGeocode = async (req, res) => {
  try {
    const { addresses } = req.body;
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ message: "Array of address strings required" });
    }

    const results = [];
    for (const address of addresses) {
      const geo = await geocodeNominatim(address);
      results.push({ address, ...(geo || { lat: null, lng: null, displayName: null }) });
      if (global.geocodeDelay) await new Promise((r) => setTimeout(r, global.geocodeDelay));
      else await new Promise((r) => setTimeout(r, 1000));
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getLoadRoute = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id)
      .select("pickupLocation deliveryLocation pickupLat pickupLng deliveryLat deliveryLng routeDistance routeDuration routePolyline ticketNumber");

    if (!load) return res.status(404).json({ message: "Load not found" });

    const route = {
      pickupLocation: load.pickupLocation,
      deliveryLocation: load.deliveryLocation,
      pickupLat: load.pickupLat,
      pickupLng: load.pickupLng,
      deliveryLat: load.deliveryLat,
      deliveryLng: load.deliveryLng,
      distance: load.routeDistance,
      duration: load.routeDuration,
      polyline: load.routePolyline ? (() => { try { return JSON.parse(load.routePolyline); } catch { return null; } })() : null,
    };

    if (!route.pickupLat || !route.deliveryLat) {
      return res.json({ ...route, needsGeocode: true });
    }

    if (!route.distance) {
      const straightLine = haversineDistance(route.pickupLat, route.pickupLng, route.deliveryLat, route.deliveryLng);
      route.distance = Math.round(straightLine * 100) / 100;
      route.duration = estimateEta(straightLine);
    }

    res.json(route);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const GEOFENCE_RADIUS_KM = 1;

exports.checkGeofence = async (req, res) => {
  try {
    const { loadId, currentLat, currentLng } = req.body;
    if (!loadId || currentLat == null || currentLng == null) {
      return res.status(400).json({ message: "loadId, currentLat, currentLng are required" });
    }

    const load = await Load.findById(loadId).select("pickupLat pickupLng deliveryLat deliveryLng status milestones ticketNumber");
    if (!load) return res.status(404).json({ message: "Load not found" });

    const results = [];

    if (load.pickupLat && load.pickupLng) {
      const distToPickup = haversineDistance(currentLat, currentLng, load.pickupLat, load.pickupLng);
      const atPickup = distToPickup <= GEOFENCE_RADIUS_KM;
      if (atPickup && !load.milestones?.arrivedPickupAt) {
        load.milestones = { ...load.milestones, arrivedPickupAt: new Date() };
        await load.save();
      }
      results.push({ type: "pickup", distanceKm: Math.round(distToPickup * 100) / 100, withinGeofence: atPickup });
    }

    if (load.deliveryLat && load.deliveryLng) {
      const distToDelivery = haversineDistance(currentLat, currentLng, load.deliveryLat, load.deliveryLng);
      const atDelivery = distToDelivery <= GEOFENCE_RADIUS_KM;
      if (atDelivery && load.milestones?.arrivedPickupAt && !load.milestones?.arrivedDeliveryAt) {
        load.milestones = { ...load.milestones, arrivedDeliveryAt: new Date() };
        await load.save();
      }
      results.push({ type: "delivery", distanceKm: Math.round(distToDelivery * 100) / 100, withinGeofence: atDelivery });
    }

    res.json({
      loadId: load._id,
      ticketNumber: load.ticketNumber,
      currentStatus: load.status,
      geofences: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
