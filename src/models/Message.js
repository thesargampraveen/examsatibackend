const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Set when the message belongs to a group chat (recipient stays null then)
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
    text: { type: String, required: true, trim: true, maxLength: 2000 },
    // true for "Rahul created group" / "Rahul added Priya" notices (no sender bubble)
    system: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
