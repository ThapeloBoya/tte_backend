const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const PRIMARY = "#003366";
const PRIMARY_LIGHT = "#004d99";
const BG_LIGHT = "#f5f7fa";
const BG_DARK = "#002244";
const TEXT_DARK = "#1a1a1a";
const TEXT_MUTED = "#666666";
const BORDER = "#d0d5dd";
const WHITE = "#ffffff";

const addHeader = (doc) => {
  doc.rect(0, 0, doc.page.width, 110).fill(BG_DARK);

  const logoPath = path.join(__dirname, "../assets/logo.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 22, { width: 70 });
  }

  doc.fillColor(WHITE);
  doc.fontSize(18).font("Helvetica-Bold").text("Moova Logistics.", 140, 28, { align: "right" });
  doc.fontSize(9).font("Helvetica").text("13 Powerel Street, Germiston  |  +27 11 225 2679  |  info@moova.co.za", 140, 55, { align: "right" });

  doc.fillColor("rgba(255,255,255,0.3)");
  doc.rect(50, 80, doc.page.width - 100, 1).fill();

  doc.y = 130;
};

const addFooter = (doc) => {
  const footerY = doc.page.height - 40;
  doc.rect(50, footerY - 10, doc.page.width - 100, 1).fillColor(BORDER).fill();

  doc.fillColor(TEXT_MUTED);
  doc.fontSize(8).font("Helvetica").text(
    "Moova Logistics  |  13 Powerel Street, Germiston  |  +27 11 225 2679  |  info@moova.co.za",
    50, footerY + 2, { align: "center" }
  );
  doc.fontSize(7).text(
    `Document generated ${new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`,
    { align: "center" }
  );
};

const addSection = (doc, label, y, height) => {
  doc.rect(50, y, doc.page.width - 100, height).fillColor(BG_LIGHT).fill();
  doc.rect(50, y, 4, height).fillColor(PRIMARY).fill();
  doc.fillColor(PRIMARY).fontSize(11).font("Helvetica-Bold").text(label, 66, y + 8);
  return y + 24;
};

const addTableHeader = (doc, headers, startX, colWidths, y) => {
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 22).fillColor(PRIMARY).fill();
  doc.fillColor(WHITE).fontSize(9).font("Helvetica-Bold");
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x + 6, y + 5, { width: colWidths[i] - 12, align: i === 0 ? "left" : "right" });
    x += colWidths[i];
  });
  return y + 22;
};

const addTableRow = (doc, cells, startX, colWidths, y, isAlt) => {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  if (isAlt) doc.rect(startX, y, totalW, 20).fillColor("#edf2f7").fill();
  doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica");
  let x = startX;
  cells.forEach((c, i) => {
    doc.text(c, x + 6, y + 4, { width: colWidths[i] - 12, align: i === 0 ? "left" : "right" });
    x += colWidths[i];
  });
  return y + 20;
};

module.exports = { addHeader, addFooter, addSection, addTableHeader, addTableRow, PRIMARY, TEXT_MUTED, TEXT_DARK };
