const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    graceMinutes: { type: Number, default: 120, min: 0, max: 720 }
  },
  { timestamps: true, versionKey: false }
);

schema.index({ branchId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Shift', schema);
