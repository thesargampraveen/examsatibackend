const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return '';
}

// POST /api/auth/send-otp  { phone }
router.post('/send-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (phone.length !== 13) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        verificationStatus: 'phone_verified',
      });
    }
    if (user.isBanned) {
      return res.status(403).json({ message: 'This account has been suspended' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();

    // MOCK MODE: real SMS provider is not wired yet.
    console.log(`[MOCK OTP] ${phone} -> ${code}`);
    res.json({
      message: 'OTP sent',
      // devMode OTP lets the app work without an SMS provider; remove in production
      devOtp: process.env.NODE_ENV === 'production' ? undefined : code,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not send OTP', error: err.message });
  }
});

// POST /api/auth/verify-otp  { phone, otp }
router.post('/verify-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.otp || '').trim();
    const user = await User.findOne({ phone });

    if (!user || !user.otp.code || !user.otp.expiresAt) {
      return res.status(400).json({ message: 'Request a new OTP first' });
    }
    if (user.otp.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired, request a new one' });
    }
    if (user.otp.code !== code) {
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    user.otp = { code: null, expiresAt: null };
    await user.save();
    if (user.examCenter) {
      await user.populate('examCenter', 'name city code');
    }

    res.json({
      token: signToken(user),
      isNewUser: !user.name,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

// POST /api/auth/complete-profile  (auth)  { name, gender, homeCity, exam, examCenterId, examDate, rollNumber }
router.post('/complete-profile', auth, async (req, res) => {
  try {
    const { name, gender, homeCity, exam, examCenterId, examDate, rollNumber } = req.body;
    if (!name || !gender || !exam || !examCenterId) {
      return res.status(400).json({ message: 'Name, gender, exam and exam center are required' });
    }

    const user = req.user;
    user.name = String(name).trim().slice(0, 60);
    user.gender = gender;
    user.homeCity = String(homeCity || '').trim();
    user.exam = exam;
    user.examCenter = examCenterId;
    user.examDate = examDate || null;
    if (rollNumber) {
      user.admitCard = {
        rollNumber: String(rollNumber).trim().slice(0, 40),
        // MOCK admit-card check: in production this would OCR/validate the uploaded card
        imageChecked: true,
        checkedAt: new Date(),
      };
      user.verificationStatus = 'verified';
    }
    await user.save();
    await user.populate('examCenter', 'name city code');

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Could not save profile', error: err.message });
  }
});

// GET /api/auth/me (auth) — fetch current profile
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
