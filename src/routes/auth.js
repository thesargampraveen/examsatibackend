const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PASSWORD_MIN = 6;

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

// POST /api/auth/register  { name, phone, password }
router.post('/register', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');

    if (phone.length !== 13) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN} characters` });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: 'This number is already registered — please log in' });
    }

    const user = await User.create({
      phone,
      name: name.slice(0, 60),
      password: await bcrypt.hash(password, 10),
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      verificationStatus: 'profile_pending',
    });

    res.status(201).json({
      token: signToken(user),
      isNewUser: true,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// POST /api/auth/login  { phone, password }
router.post('/login', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || '');

    if (phone.length !== 13) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // +password: the hash is select:false, so ask for it explicitly
    const user = await User.findOne({ phone }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ message: 'No account with this number — please register' });
    }
    if (user.isBanned) {
      return res.status(403).json({ message: 'This account has been suspended' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    if (user.examCenter) {
      await user.populate('examCenter', 'name city code');
    }

    res.json({
      token: signToken(user),
      isNewUser: false,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
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
router.get('/me', auth, async (req, res) => {
  try {
    if (req.user.examCenter) {
      await req.user.populate('examCenter', 'name city code');
    }
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: 'Could not load profile', error: err.message });
  }
});

module.exports = router;
