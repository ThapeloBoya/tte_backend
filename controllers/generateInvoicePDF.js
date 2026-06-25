const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { addHeader, addFooter, addSection, addTableHeader, addTableRow, PRIMARY, TEXT_MUTED, TEXT_DARK } = require("../utils/pdfLayout");

const generateInvoicePDF = (invoice) => {
  return new Promise((resolve, reject) => {
  const filename = `${invoice.invoiceNumber}.pdf`;
  const filePath = path.join(__dirname, "../uploads", filename);

  const writeStream = fs.createWriteStream(filePath);
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(writeStream);

  addHeader(doc);

  doc.fontSize(18).font("Helvetica-Bold").fillColor(PRIMARY).text("INVOICE", { align: "center" });
  doc.fontSize(10).fillColor(TEXT_MUTED).font("Helvetica").text(`# ${invoice.invoiceNumber}`, { align: "center" });
  doc.moveDown(1.5);

  let sy = doc.y;
  const col1 = 66, col2 = 300;

  sy = addSection(doc, "Invoice Information", sy, 24);
  doc.fontSize(10).font("Helvetica").fillColor(TEXT_DARK);
  doc.text(`Status: ${(invoice.status || "draft").toUpperCase()}`, col1, sy);
  doc.text(`Issued: ${invoice.issuedDate ? new Date(invoice.issuedDate).toDateString() : "-"}`, col2, sy);
  sy += 18;
  doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toDateString() : "-"}`, col1, sy);
  sy += 24;

  const billTo = invoice.billTo || {};
  sy = addSection(doc, "Bill To", sy, 24);
  doc.fontSize(10).fillColor(TEXT_DARK);
  doc.text(billTo.name || "-", col1, sy);
  sy += 18;
  if (billTo.email) doc.text(billTo.email, col1, sy);
  if (billTo.phone) doc.text(billTo.phone, col2, sy);
  sy += 18;
  if (billTo.address) doc.text(billTo.address, col1, sy);
  sy += 24;

  const lineItems = invoice.lineItems || [];
  if (lineItems.length > 0) {
    const startX = 50;
    const colWidths = [30, 210, 60, 70, 100];

    sy = addSection(doc, "Line Items", sy, 24);
    sy = addTableHeader(doc, ["#", "Description", "Qty", "Rate", "Amount"], startX, colWidths, sy);

    lineItems.forEach((item, i) => {
      sy = addTableRow(doc, [
        `${i + 1}`,
        item.description || "-",
        `${item.quantity || 1}`,
        `R${(item.rate || 0).toFixed(2)}`,
        `R${(item.amount || 0).toFixed(2)}`,
      ], startX, colWidths, sy, i % 2 === 1);
    });
    sy += 10;
  }

  const totalsX = 340;
  sy += 4;
  doc.fontSize(10).font("Helvetica").fillColor(TEXT_DARK);
  doc.text("Subtotal:", totalsX, sy);
  doc.text(`R${(invoice.subtotal || 0).toFixed(2)}`, totalsX, sy, { align: "right" });
  sy += 16;
  if (invoice.discount) {
    doc.text("Discount:", totalsX, sy);
    doc.text(`-R${(invoice.discount || 0).toFixed(2)}`, totalsX, sy, { align: "right" });
    sy += 16;
  }
  doc.text(`Tax (${invoice.taxPercent || 0}%):`, totalsX, sy);
  doc.text(`R${(invoice.taxAmount || 0).toFixed(2)}`, totalsX, sy, { align: "right" });
  sy += 18;

  doc.rect(totalsX - 10, sy, doc.page.width - totalsX - 20, 24).fillColor(PRIMARY).fill();
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#ffffff");
  doc.text("TOTAL:", totalsX - 4, sy + 5);
  doc.text(`R${(invoice.total || 0).toFixed(2)}`, totalsX - 4, sy + 5, { align: "right" });
  sy += 34;

  sy = addSection(doc, "Payment Details", sy, 24);
  doc.fontSize(10).font("Helvetica").fillColor(TEXT_DARK);
  doc.text("Bank: First National Bank (FNB)", col1, sy);
  doc.text("Account Number: 6281 5217 0892", col2, sy);
  sy += 18;
  doc.text("Account Holder: Moova Logistics", col1, sy);
  doc.text("Branch Code: 255005", col2, sy);
  sy += 18;
  doc.fontSize(9).fillColor(PRIMARY).font("Helvetica-Bold");
  doc.text(`Reference: ${invoice.invoiceNumber}`, col1, sy);
  doc.fontSize(8).font("Helvetica").fillColor(TEXT_MUTED);
  doc.text("Please quote the invoice number as reference.", col1 + 110, sy);
  sy += 24;

  if (invoice.notes) {
    sy = addSection(doc, "Notes", sy, 24);
    doc.fontSize(9).font("Helvetica").fillColor(TEXT_DARK);
    doc.text(invoice.notes, col1, sy);
  }

  addFooter(doc);

  writeStream.on("finish", () => resolve(`/uploads/${filename}`));
  writeStream.on("error", reject);
  doc.end();
  });
};

module.exports = { generateInvoicePDF };
