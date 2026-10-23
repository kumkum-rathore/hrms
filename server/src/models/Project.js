const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
  description: { type: String, trim: true, default: '', maxlength: 5000 },
  clientName: { type: String, trim: true, default: '', maxlength: 180 },
  clientPhone: { type: String, trim: true, default: '', maxlength: 40 },
  clientDetails: { type: String, trim: true, default: '', maxlength: 2000 },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  startDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'], default: 'PLANNING', index: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false });

projectSchema.index({ branchId:  1, status: 1, dueDate: 1 });
module.exports = mongoose.model('Project', projectSchema);
