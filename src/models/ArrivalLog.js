const mongoose = require('mongoose');

// "I reached" button: log every safe-arrival notification sent to the guardian contact
const arrivalLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    guardianName: { type: String, default: '' },
    guardianPhone: { type: String, default: '' },
    deliveredVia: { type: String, enum: ['mock', 'sms'], default: 'mock' },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamCenter', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ArrivalLog', arrivalLogSchema);
