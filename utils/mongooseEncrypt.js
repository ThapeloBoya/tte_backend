const { encrypt, decrypt, isEncrypted } = require("./fieldEncrypt");

function encryptPlugin(schema, options) {
  const paths = options?.paths || [];

  if (paths.length === 0) return;

  schema.pre("save", function (next) {
    for (const path of paths) {
      const value = this.get(path);
      if (value != null && value !== "" && !isEncrypted(value)) {
        this.set(path, encrypt(String(value)));
      }
    }
    next();
  });

  schema.post("init", function (doc) {
    for (const path of paths) {
      const value = doc.get ? doc.get(path) : doc[path];
      if (value != null && value !== "" && isEncrypted(value)) {
        const decrypted = decrypt(value);
        if (doc.set) {
          doc.set(path, decrypted);
        } else {
          doc[path] = decrypted;
        }
      }
    }
  });

  schema.post("save", function (doc) {
    for (const path of paths) {
      const value = doc.get ? doc.get(path) : doc[path];
      if (value != null && value !== "" && isEncrypted(value)) {
        const decrypted = decrypt(value);
        if (doc.set) {
          doc.set(path, decrypted);
        } else {
          doc[path] = decrypted;
        }
      }
    }
  });
}

module.exports = encryptPlugin;