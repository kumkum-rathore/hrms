const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  branchCode: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 2, maxlength: 20 },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  address: {
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    country: { type: String, trim: true, default: 'India', maxlength: 100 },
    postalCode: { type: String, trim: true, default: '', maxlength: 20 }
  },
  officeLocation: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true, validate: { validator(v) { return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90; }, message: 'Coordinates must be [longitude, latitude].' } }
  },
  geofenceRadiusMeters: { type: Number, default: 100, min: 20, max: 2000, required: true },
  contactEmail: { type: String, trim: true, lowercase: true, default: null, maxlength: 254 },
  contactPhone: { type: String, trim: true, default: null, maxlength: 30 },
  timezone: { type: String, trim: true, default: 'Asia/Kolkata', maxlength: 100 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  branchAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, versionKey: false });
schema.index({ officeLocation: '2dsphere' });
schema.index({ status: 1, name: 1 });
module.exports = mongoose.model('Branch', schema);
