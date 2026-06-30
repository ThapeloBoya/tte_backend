const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Load = require("../models/Load");
const { ensureDriverProfile } = require("../utils/driverProfile");
const { logAction } = require("../utils/auditLogger");
const { addHeader, addFooter, addSection, addTableHeader, addTableRow, PRIMARY, TEXT_MUTED, TEXT_DARK } = require("../utils/pdfLayout");

const buildPOD = (load, filename, filePath) => {
  return new Promise((resolve, reject) => {
  const writeStream = fs.createWriteStream(filePath);
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(writeStream);

  addHeader(doc);

  doc.fontSize(18).font("Helvetica-Bold").fillColor(PRIMARY).text("PROOF OF DELIVERY", { align: "center" });
  doc.fontSize(10).fillColor(TEXT_MUTED).font("Helvetica").text(`Ticket: ${load.ticketNumber}`, { align: "center" });
  doc.moveDown(1.5);

  let sy = doc.y;

  sy = addSection(doc, "Trip Information", sy, 24);
  const col1 = 66, col2 = 300;
  doc.fontSize(10).font("Helvetica").fillColor(TEXT_DARK);
  doc.text(`Customer: ${load.customer?.name || "-"}`, col1, sy);
  doc.text(`Driver: ${load.driver?.name || load.driver?.email || "N/A"}`, col2, sy);
  sy += 18;
  doc.text(`Truck: ${load.truck?.registrationNumber || "N/A"}`, col1, sy);
  doc.text(`Cargo Type: ${load.cargoType || "-"}`, col2, sy);
  sy += 18;
  doc.text(`Collection Date: ${load.collectionDate ? new Date(load.collectionDate).toDateString() : "-"}`, col1, sy);
  doc.text(`Delivery Date: ${load.deliveryDate ? new Date(load.deliveryDate).toDateString() : "-"}`, col2, sy);
  sy += 24;

  sy = addSection(doc, "Addresses", sy, 24);
  doc.fontSize(10).fillColor(TEXT_DARK);
  doc.text(`Pickup: ${load.pickupLocation || "-"}`, col1, sy);
  sy += 18;
  doc.text(`Delivery: ${load.deliveryLocation || "-"}`, col1, sy);
  sy += 24;

  sy = addSection(doc, "Load Details", sy, 24);
  doc.fontSize(10).fillColor(TEXT_DARK);
  doc.text(`Packages: ${load.packages || "-"}`, col1, sy);
  doc.text(`Total Weight: ${load.weight ? `${load.weight} kg` : "-"}`, col2, sy);
  sy += 18;
  if (load.notes) {
    doc.text(`Notes: ${load.notes}`, col1, sy);
    sy += 20;
  }
  sy += 6;

  sy = addSection(doc, "Signatures", sy, 24);
  const driverEmail = load.driver?.email || "____________________";
  const customerName = load.customer?.name || "____________________";
  doc.fontSize(10).fillColor(TEXT_DARK);
  doc.text(`Driver: ${driverEmail}`, col1, sy);
  doc.text(`Receiver: ${customerName}`, col2, sy);
  sy += 24;

  doc.fontSize(9).fillColor(TEXT_MUTED);
  doc.text("I acknowledge receipt of the above items in good condition.", col1, sy);
  sy += 20;

  if (load.signatureUrl) {
    const sigPath = path.join(__dirname, "..", "uploads", path.basename(load.signatureUrl));
    if (fs.existsSync(sigPath)) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(PRIMARY).text("Receiver Signature:", col1, sy);
      sy += 16;
      doc.image(sigPath, col1, sy, { width: 180 });
      sy += 90;
    }
  }

  if (load.capturedPhotoUrl) {
    const photoPath = path.join(__dirname, "..", "uploads", path.basename(load.capturedPhotoUrl));
    if (fs.existsSync(photoPath)) {
      if (sy > doc.page.height - 200) {
        doc.addPage();
        addHeader(doc);
        sy = doc.y;
      }
      doc.fontSize(10).font("Helvetica-Bold").fillColor(PRIMARY).text("Delivery Photo:", col1, sy);
      sy += 16;
      const pageRemaining = doc.page.height - sy - 60;
      doc.image(photoPath, col1, sy, { width: 300, height: Math.min(200, pageRemaining) });
    }
  }

  addFooter(doc);

  writeStream.on("finish", resolve);
  writeStream.on("error", reject);
  doc.end();
  });
};

exports.generatePOD = async (req, res) => {
  try {
    const loadId = req.params.id;
    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: loadId, driver: driver._id })
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name address");

    if (!load) return res.status(404).json({ message: "Load not found" });

    const filename = `POD-${load.ticketNumber}.pdf`;
    const filePath = path.join(__dirname, "../uploads", filename);

    await buildPOD(load, filename, filePath);

    load.podUrl = `/uploads/${filename}`;
    load.status = "completed";
    load.reviewStatus = "pending";
    load.isApproved = false;
    load.approvalNote = "";
    load.rejectionNote = "";
    await load.save();

    await logAction({
      action: "pod_generated", entity: "Load", entityId: load._id, req,
      details: `POD generated for load ${load.ticketNumber}`,
    });

    res.json({ message: "POD generated successfully", podUrl: load.podUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.generatePODAdmin = async (req, res) => {
  try {
    const loadId = req.params.id;
    const load = await Load.findById(loadId)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name address");

    if (!load) return res.status(404).json({ message: "Load not found" });

    const filename = `POD-${load.ticketNumber}.pdf`;
    const filePath = path.join(__dirname, "../uploads", filename);

    await buildPOD(load, filename, filePath);

    load.podUrl = `/uploads/${filename}`;
    load.status = "completed";
    load.reviewStatus = "pending";
    load.isApproved = false;
    load.approvalNote = "";
    load.rejectionNote = "";
    load.updatedBy = req.user?.email;
    await load.save();

    await logAction({
      action: "pod_generated", entity: "Load", entityId: load._id, req,
      details: `Admin generated POD for load ${load.ticketNumber}`,
    });

    res.json({ message: "POD generated successfully", podUrl: load.podUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
