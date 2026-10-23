const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true, versionKey: false }
);

schema.index({ branchId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('BranchHoliday', schema);
