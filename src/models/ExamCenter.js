const mongoose = require('mongoose');

const examCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, index: true }, // center code printed on admit card
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    location: {
      lat: Number,
      lng: Number,
    },
  },
  { timestamps: true }
);

examCenterSchema.index({ name: 'text', city: 'text', code: 'text' });

module.exports = mongoose.model('ExamCenter', examCenterSchema);
