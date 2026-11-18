const mongoose = require('mongoose');

const guideTipSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamCenter', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: ['route', 'entry_gate', 'food', 'stay', 'carry', 'other'],
      default: 'other',
    },
    text: { type: String, required: true, trim: true, maxLength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GuideTip', guideTipSchema);
