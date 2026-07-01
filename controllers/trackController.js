const Load = require("../models/Load");

exports.getTrackByTicket = async (req, res) => {
  try {
    const { ticketNumber } = req.params;

    const load = await Load.findOne({ ticketNumber: ticketNumber.toUpperCase() })
      .populate("driver", "name email phone")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    if (!load) {
      return res.status(404).json({ message: "No shipment found with that tracking code." });
    }

    res.json({
      ticketNumber: load.ticketNumber,
      status: load.status,
      pickupLocation: load.pickupLocation,
      deliveryLocation: load.deliveryLocation,
      cargoType: load.cargoType,
      priority: load.priority,
      collectionDate: load.collectionDate,
      deliveryDate: load.deliveryDate,
      customer: load.customer?.name || null,
      driver: load.driver ? { name: load.driver.name, phone: load.driver.phone } : null,
      truck: load.truck?.registrationNumber || null,
      milestones: load.milestones || {},
      isApproved: load.isApproved || false,
    });
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
