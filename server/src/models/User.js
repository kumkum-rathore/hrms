const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  employeeCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true, maxlength: 40 },
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, trim: true, default: '', maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, trim: true, default: null, maxlength: 30 },
  role: { type: String, enum: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HOD', 'TEAM_LEAD', 'EMPLOYEE'], default: 'EMPLOYEE', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomRole', default: null },
  permissions: { type: [String], default: [] },
  experienceYears: { type: Number, default: 0, min: 0, max: 70 },
  experienceSummary: { type: String, default: '', maxlength: 2000 },
  hasPreviousExperience: { type: Boolean, default: false },
  previousCompanyName: { type: String, trim: true, default: '', maxlength: 120 },
  previousCompanyLeavingDate: { type: Date, default: null },
  previousCompanyLeavingReason: { type: String, trim: true, default: '', maxlength: 1000 },
  leavingDate: { type: Date, default: null },
  salaryAmount: { type: Number, default: 0, min: 0 },
  salaryCurrency: { type: String, default: 'INR', enum: ['INR'] },
  reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'INVITED', index: true },
  isArchived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date, default: null },
  joiningDate: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0, min: 0 },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
userSchema.index({ branchId: 1, departmentId: 1, status: 1 });
module.exports = mongoose.model('User', userSchema);
