const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // 🆕 Designated reviewer — jis user ko submit kiya gaya hai
    submittedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    note: { type: String, default: '', maxlength: 2000 },
    files: [
      {
        name: String,
        url: String,
        // 🆕 External URL (user-provided link, e.g. GitHub / demo)
        externalUrl: { type: String, default: '' },
        mimeType: String,
        size: Number
      }
    ],
    status: {
      type: String,
      enum: ['SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED'],
      required: true
    },
    reviewNote: { type: String, default: '', maxlength: 2000 },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null }
  },
  { _id: true }
);

const schema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 180
    },
    description: { type: String, required: true, maxlength: 5000 },
    taskType: {
      type: String,
      enum: ['GENERAL', 'DEVELOPMENT', 'TESTING', 'BUG_FIX', 'DOCUMENTATION', 'DESIGN'],
      default: 'GENERAL'
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED'],
      default: 'TODO',
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    dueDate: { type: Date, default: null },
    checklist: [
      {
        title: { type: String, required: true, trim: true, maxlength: 180 },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date, default: null }
      }
    ],
    estimatedHours: { type: Number, min: 0, max: 10000, default: 0 },
    actualHours: { type: Number, min: 0, max: 10000, default: 0 },
    workLogs: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true, maxlength: 1000 },
        hours: { type: Number, min: 0, max: 24, default: 0 },
        progress: { type: Number, min: 0, max: 100 },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    activityLog: [
      {
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        action: {
          type: String,
          enum: [
            'TASK_ASSIGNED',
            'CHECKLIST_UPDATED',
            'PROGRESS_UPDATED',
            'SUBMITTED',
            'APPROVED',
            'CHANGES_REQUESTED',
            'TASK_UPDATED',
            'TASK_ARCHIVED'
          ],
          required: true
        },
        details: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    progress: { type: Number, min: 0, max: 100, default: 0 },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    submissions: [submissionSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true, versionKey: false }
);

schema.index({ branchId: 1, assignedTo: 1, status: 1 });

module.exports = mongoose.model('Task', schema);