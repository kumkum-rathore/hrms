const mongoose = require('mongoose');
const schema = new mongoose.Schema({ branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true }, name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 }, code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 }, description: { type: String, default: '', maxlength: 500 }, isArchived: { type: Boolean, default: false, index: true }, archivedAt: { type: Date, default: null }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true, versionKey: false });
schema.index({ branchId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('CustomRole', schema);
