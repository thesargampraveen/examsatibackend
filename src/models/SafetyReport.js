const mongoose = require('mongoose');

const safetyReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['spam', 'fake_agent', 'harassment', 'coaching_ad', 'other'],
      default: 'other',
    },
    details: { type: String, trim: true, default: '', maxLength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SafetyReport', safetyReportSchema);
