const Invoice = require("../models/Invoice");
const Fuel = require("../models/Fuel");
const Load = require("../models/Load");
const Maintenance = require("../models/Maintenance");
const Truck = require("../models/Truck");
const Driver = require("../models/Driver");

exports.getProfitability = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "truck" } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [invoiceData, fuelData, maintenanceData, loadData] = await Promise.all([
      Invoice.aggregate([
        { $match: { ...dateFilter, status: { $ne: "cancelled" } } },
        { $group: { _id: null, totalRevenue: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
      Fuel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, totalFuelCost: { $sum: "$totalCost" }, totalLiters: { $sum: "$liters" } } },
      ]),
      Maintenance.aggregate([
        { $match: { ...dateFilter, status: "completed" } },
        { $group: { _id: null, totalMaintenanceCost: { $sum: "$cost" }, count: { $sum: 1 } } },
      ]),
      Load.aggregate([
        { $match: { ...dateFilter, status: "completed" } },
        { $group: { _id: null, totalLoads: { $sum: 1 }, totalDistance: { $sum: "$routeDistance" } } },
      ]),
    ]);

    let byGroup = [];
    if (groupBy === "truck") {
      const invoiceByTruck = await Invoice.aggregate([
        { $match: { ...dateFilter, status: { $ne: "cancelled" } } },
        { $group: { _id: "$driver", totalRevenue: { $sum: "$total" } } },
      ]);
      const fuelByTruck = await Fuel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$truck", totalFuelCost: { $sum: "$totalCost" }, totalLiters: { $sum: "$liters" } } },
      ]);
      const maintByTruck = await Maintenance.aggregate([
        { $match: { ...dateFilter, status: "completed" } },
        { $group: { _id: "$truck", totalMaintenanceCost: { $sum: "$cost" } } },
      ]);
      const loadByTruck = await Load.aggregate([
        { $match: { ...dateFilter, status: "completed" } },
        { $group: { _id: "$truck", totalLoads: { $sum: 1 }, totalDistance: { $sum: "$routeDistance" } } },
      ]);

      const truckMap = {};
      [...invoiceByTruck, ...fuelByTruck, ...maintByTruck, ...loadByTruck].forEach((item) => {
        if (!item._id) return;
        if (!truckMap[item._id]) truckMap[item._id] = {};
        Object.assign(truckMap[item._id], item);
      });

      const truckIds = Object.keys(truckMap);
      const trucks = await Truck.find({ _id: { $in: truckIds } }).select("registrationNumber model make");
      const truckLookup = {};
      trucks.forEach((t) => { truckLookup[t._id] = t; });

      byGroup = truckIds.map((id) => {
        const d = truckMap[id];
        const t = truckLookup[id];
        const revenue = d.totalRevenue || 0;
        const costs = (d.totalFuelCost || 0) + (d.totalMaintenanceCost || 0);
        return {
          _id: id,
          name: t ? `${t.registrationNumber} (${t.model})` : "Unknown",
          totalRevenue: revenue,
          totalFuelCost: d.totalFuelCost || 0,
          totalMaintenanceCost: d.totalMaintenanceCost || 0,
          totalCosts: costs,
          profit: revenue - costs,
          margin: revenue > 0 ? ((revenue - costs) / revenue * 100).toFixed(1) : 0,
          totalLoads: d.totalLoads || 0,
          totalDistance: d.totalDistance || 0,
        };
      }).sort((a, b) => b.profit - a.profit);
    }

    const revenue = invoiceData[0]?.totalRevenue || 0;
    const fuelCost = fuelData[0]?.totalFuelCost || 0;
    const maintCost = maintenanceData[0]?.totalMaintenanceCost || 0;
    const totalCosts = fuelCost + maintCost;

    res.json({
      summary: {
        totalRevenue: revenue,
        totalFuelCost: fuelCost,
        totalMaintenanceCost: maintCost,
        totalCosts,
        profit: revenue - totalCosts,
        margin: revenue > 0 ? ((revenue - totalCosts) / revenue * 100).toFixed(1) : 0,
        totalLoads: loadData[0]?.totalLoads || 0,
        totalDistance: loadData[0]?.totalDistance || 0,
        totalLiters: fuelData[0]?.totalLiters || 0,
      },
      byGroup,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getDriverScorecard = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const driver = await Driver.findById(driverId).select("name email phone licenseNumber status");
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const loads = await Load.find({ driver: driverId, ...dateFilter })
      .populate("truck", "registrationNumber")
      .sort({ createdAt: -1 });

    const completedLoads = loads.filter((l) => l.status === "completed");
    const totalLoads = loads.length;
    const totalCompleted = completedLoads.length;
    const inTransitLoads = loads.filter((l) => l.status === "in transit").length;
    const canceledLoads = loads.filter((l) => l.status === "canceled").length;

    let onTimeCount = 0;
    let lateCount = 0;
    completedLoads.forEach((load) => {
      if (load.milestones?.completedAt && load.deliveryDate) {
        if (new Date(load.milestones.completedAt) <= new Date(load.deliveryDate)) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      }
    });

    const issues = loads.filter((l) => l.driverIssue?.description);
    const openIssues = issues.filter((l) => l.driverIssue?.status === "open");
    const resolvedIssues = issues.filter((l) => l.driverIssue?.status === "resolved");

    const fuelRecords = await Fuel.find({
      _id: { $in: completedLoads.map((l) => l.truck?._id).filter(Boolean) },
    });

    const totalFuelLiters = fuelRecords.reduce((sum, f) => sum + (f.liters || 0), 0);
    const totalDistance = completedLoads.reduce((sum, l) => sum + (l.routeDistance || 0), 0);
    const fuelEfficiency = totalFuelLiters > 0 && totalDistance > 0
      ? (totalDistance / totalFuelLiters).toFixed(1) : null;

    const onTimePercent = totalCompleted > 0 ? ((onTimeCount / totalCompleted) * 100).toFixed(1) : null;

    res.json({
      driver,
      summary: {
        totalLoads,
        totalCompleted,
        inTransitLoads,
        canceledLoads,
        onTimeCount,
        lateCount,
        onTimePercent,
        totalIssues: issues.length,
        openIssues: openIssues.length,
        resolvedIssues: resolvedIssues.length,
        totalDistance: Math.round(totalDistance),
        totalFuelLiters: Math.round(totalFuelLiters),
        fuelEfficiency: fuelEfficiency ? `${fuelEfficiency} km/L` : "N/A",
      },
      recentLoads: loads.slice(0, 10).map((l) => ({
        _id: l._id,
        ticketNumber: l.ticketNumber,
        customer: l.customer?.name,
        pickupLocation: l.pickupLocation,
        deliveryLocation: l.deliveryLocation,
        status: l.status,
        distance: l.routeDistance,
        completedAt: l.milestones?.completedAt,
        deliveryDate: l.deliveryDate,
        driverIssue: l.driverIssue,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
