const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true },
    // bcrypt hash — select:false keeps it out of normal queries, toJSON strips it from responses
    password: { type: String, select: false, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    homeCity: { type: String, trim: true, default: '' },
    exam: { type: String, trim: true, default: '' }, // JEE / NEET / UPSC / SSC / GATE / Railway ...
    examCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamCenter', default: null },
    examDate: { type: Date, default: null },
    // Admit-card details: retained only as long as needed for verification + center matching
    admitCard: {
      rollNumber: { type: String, trim: true, default: '' },
      imageChecked: { type: Boolean, default: false },
      checkedAt: { type: Date, default: null },
    },
    verificationStatus: {
      type: String,
      enum: ['phone_verified', 'profile_pending', 'verified', 'rejected'],
      default: 'phone_verified',
    },
    guardian: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    avatarColor: { type: String, default: '#4F46E5' },
    otp: {
      code: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },
    isBanned: { type: Boolean, default: false },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Never send OTP or admit-card internals to the client
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.otp;
    delete ret.password;
    delete ret.admitCard;
    delete ret.blockedUsers;
    delete ret.isBanned;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
