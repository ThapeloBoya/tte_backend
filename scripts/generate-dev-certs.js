const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CERTS_DIR = path.join(__dirname, "..", "certs");
const KEY_PATH = path.join(CERTS_DIR, "key.pem");
const CERT_PATH = path.join(CERTS_DIR, "cert.pem");

function generate() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    console.log("Dev certs already exist at", CERTS_DIR);
    return;
  }

  fs.mkdirSync(CERTS_DIR, { recursive: true });

  const subject = "/C=ZA/ST=Gauteng/L=Johannesburg/O=TMS/OU=Dev/CN=localhost";

  try {
    execSync(
      `openssl req -x509 -nodes -days 3650 -newkey rsa:2048 ` +
      `-keyout "${KEY_PATH}" -out "${CERT_PATH}" ` +
      `-subj "${subject}" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: "inherit" }
    );
    console.log("Dev certificates generated:");
    console.log("  Key:  ", KEY_PATH);
    console.log("  Cert: ", CERT_PATH);
  } catch (err) {
    console.error("Failed to generate certificates. Is OpenSSL installed?");
    console.error(err.message);
    process.exit(1);
  }
}

generate();