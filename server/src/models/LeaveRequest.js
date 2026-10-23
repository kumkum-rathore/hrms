const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  leaveType: { type: String, enum: ['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'OTHER'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decisionAt: { type: Date, default: null },
  decisionNote: { type: String, default: '', maxlength: 500 }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('LeaveRequest', schema);
