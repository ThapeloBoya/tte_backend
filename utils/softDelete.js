const softDeletePlugin = (schema) => {
  schema.add({
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  });

  schema.methods.softDelete = function (deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy || null;
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  schema.statics.findNotDeleted = function (...args) {
    const query = args[0] || {};
    if (query.isDeleted === undefined) query.isDeleted = { $ne: true };
    return this.find(...args);
  };

  schema.statics.findOneNotDeleted = function (...args) {
    const query = args[0] || {};
    if (query.isDeleted === undefined) query.isDeleted = { $ne: true };
    return this.findOne(...args);
  };

  schema.pre(/^find/, function () {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
  });

  schema.pre("countDocuments", function () {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
  });
};

module.exports = softDeletePlugin;
