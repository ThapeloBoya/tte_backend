const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Load = require("../models/Load");

exports.generatePOD = async (req, res) => {
  try {
    const loadId = req.params.id;
    const load = await Load.findById(loadId)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name address");

    if (!load) return res.status(404).json({ message: "Load not found" });

    const filename = `POD-${load.ticketNumber}.pdf`;
    const filePath = path.join(__dirname, "../uploads", filename);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));

    // ----- Header -----
    const logoPath = path.join(__dirname, "../assets/logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 80 });
    }
    doc.fontSize(20).fillColor("#003366").text("TTE Mobility.", 150, 50, { align: "right" });
    doc.fontSize(10).fillColor("#555555").text("12 Power Street, Isando, The Foundry Unit 19 | +27 64 536 2679 |  info@ttemobility.co.za", { align: "right" });
    doc.moveDown(2);

    // ----- POD Title -----
    doc.fontSize(16).fillColor("#000000").text("PROOF OF DELIVERY (POD)", { align: "center", underline: true });
    doc.moveDown(1.5);

    // ----- Load Info -----
    doc.rect(50, doc.y, doc.page.width - 100, 70).strokeColor("#003366").stroke();
    doc.fontSize(12).fillColor("#000000");
    doc.text(`Ticket Number: ${load.ticketNumber}`, 60, doc.y + 5);
    doc.text(`Customer: ${load.customer?.name || "-"}`, 300, doc.y - 15);
    doc.text(`Pickup Date: ${load.collectionDate ? new Date(load.collectionDate).toDateString() : "-"}`, 60, doc.y + 20);
    doc.text(`Delivery Date: ${load.deliveryDate ? new Date(load.deliveryDate).toDateString() : "-"}`, 300, doc.y - 15);
    doc.moveDown(3);

    // ----- Addresses -----
    doc.rect(50, doc.y, doc.page.width - 100, 60).strokeColor("#003366").stroke();
    doc.text(`Pickup Address: ${load.pickupLocation}`, 60, doc.y + 5);
    doc.text(`Delivery Address: ${load.deliveryLocation}`, 60, doc.y + 20);
    doc.moveDown(3);

    // ----- Driver & Truck -----
    doc.rect(50, doc.y, doc.page.width - 100, 50).strokeColor("#003366").stroke();
    doc.text(`Driver: ${load.driver?.name || "-"}`, 60, doc.y + 5);
    doc.text(`Driver Email: ${load.driver?.email || "-"}`, 300, doc.y - 15);
    doc.text(`Truck Reg #: ${load.truck?.registrationNumber || "-"}`, 60, doc.y + 20);
    doc.moveDown(3);

    // ----- Load Details -----
    const totalPackages = load.deliveries.length;
    const totalWeight = load.deliveries.reduce((sum, d) => sum + (d.weight || 0), 0);
    doc.text(`Number of Packages: ${totalPackages}`);
    doc.text(`Total Weight: ${totalWeight} kg`);
    doc.text(`Cargo Type: ${load.cargoType || "-"}`);
    doc.text(`Notes: ${load.notes || "-"}`);
    doc.moveDown(2);

    // ----- Delivered Items Table -----
    if (load.deliveries.length > 0) {
      const tableTop = doc.y;
      const itemX = 50;
      const colWidths = [40, 100, 60, 80, 100];

      // Table Header with color
      doc.font("Helvetica-Bold").fillColor("#003366");
      ["No.", "Delivery #", "Amount", "Weight (kg)", "Status"].forEach((text, i) => {
        doc.text(text, itemX + colWidths.slice(0, i).reduce((a,b)=>a+b,0), tableTop, { width: colWidths[i], align: "left" });
      });
      doc.moveDown(0.5);
      doc.font("Helvetica").fillColor("#000000");

      load.deliveries.forEach((item, index) => {
        const y = doc.y;
        doc.text(`${index + 1}`, itemX, y, { width: colWidths[0] });
        doc.text(item.deliveryNumber || "-", itemX + colWidths[0], y, { width: colWidths[1] });
        doc.text(item.amount || "-", itemX + colWidths[0] + colWidths[1], y, { width: colWidths[2] });
        doc.text(item.weight || "-", itemX + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3] });
        doc.text(item.status || "-", itemX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, { width: colWidths[4] });
        doc.moveDown(0.5);
      });
      doc.moveDown();
    }

    // ----- Signatures -----
    doc.text("Signatures:", { underline: true }).moveDown(0.5);
    doc.text(`Driver: ${load.driver?.email}`, 60, doc.y, { continued: true })
       .text(`Receiver: ${load.customer?.name}`, 300, doc.y, { align: "right" });
    doc.moveDown(3);

    // ----- Footer -----
    const footerY = doc.page.height - 50;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor("#003366").stroke();
    doc.fontSize(10).fillColor("#555555").text(
      `Generated on: ${new Date().toDateString()} | TTE Mobility | +27 64 536 2679 |  info@ttemobility.co.za`,
      50,
      footerY + 5,
      { align: "center" }
    );

    doc.end();

    // Save POD URL
    load.podUrl = `/uploads/${filename}`;
    await load.save();

    res.json({ message: "POD generated successfully", podUrl: load.podUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
