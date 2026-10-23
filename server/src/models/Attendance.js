const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  workDate: { type: String, required: true },
  checkInAt: { type: Date, default: null },
  checkOutAt: { type: Date, default: null },
  checkInLocation: { latitude: Number, longitude: Number, distanceMeters: Number },
  checkOutLocation: { latitude: Number, longitude: Number, distanceMeters: Number },
  status: { type: String, enum: ['PRESENT', 'HALF_DAY', 'INCOMPLETE', 'ABSENT'], default: 'INCOMPLETE' }
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, workDate: 1 }, { unique: true });
module.exports = mongoose.model('Attendance', schema);
