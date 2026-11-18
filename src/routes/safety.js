const express = require('express');
const User = require('../models/User');
const SafetyReport = require('../models/SafetyReport');
const ArrivalLog = require('../models/ArrivalLog');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/safety/guardian
router.get('/guardian', auth, (req, res) => {
  res.json({ guardian: req.user.guardian });
});

// PUT /api/safety/guardian  { name, phone } — the contact notified by "I reached"
router.put('/guardian', auth, async (req, res) => {
  try {
    req.user.guardian = {
      name: String(req.body.name || '').trim().slice(0, 60),
      phone: String(req.body.phone || '').replace(/\D/g, '').slice(0, 13),
    };
    await req.user.save();
    res.json({ guardian: req.user.guardian });
  } catch (err) {
    res.status(500).json({ message: 'Could not save guardian', error: err.message });
  }
});

// POST /api/safety/reached — "I reached" button
router.post('/reached', auth, async (req, res) => {
  try {
    const { guardian } = req.user;
    if (!guardian || !guardian.phone) {
      return res.status(400).json({
        message: 'Add a parent/guardian contact first',
        needsGuardian: true,
      });
    }
    // MOCK delivery: replace with an SMS provider call in production
    console.log(
      `[MOCK SMS] To ${guardian.phone}: Your child ${req.user.name || req.user.phone} has reached the exam center safely. - ExamSaathi`
    );
    await ArrivalLog.create({
      user: req.user._id,
      guardianName: guardian.name,
      guardianPhone: guardian.phone,
      deliveredVia: 'mock',
      center: req.user.examCenter || null,
    });
    res.json({
      message: `Arrival alert sent to ${guardian.name || 'your guardian'}`,
      deliveredAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not send arrival alert', error: err.message });
  }
});

// GET /api/safety/blocked
router.get('/blocked', auth, async (req, res) => {
  const users = await User.find({ _id: { $in: req.user.blockedUsers } }).select('name phone');
  res.json({ blocked: users });
});

// POST /api/safety/block  { userId }
router.post('/block', auth, async (req, res) => {
  try {
    const targetId = req.body.userId;
    if (!targetId || targetId === String(req.user._id)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    if (!(req.user.blockedUsers || []).some((id) => id.equals(targetId))) {
      req.user.blockedUsers = [...(req.user.blockedUsers || []), targetId];
      await req.user.save();
    }
    res.json({ message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ message: 'Could not block user', error: err.message });
  }
});

// POST /api/safety/unblock  { userId }
router.post('/unblock', auth, async (req, res) => {
  try {
    req.user.blockedUsers = (req.user.blockedUsers || []).filter((id) => !id.equals(req.body.userId));
    await req.user.save();
    res.json({ message: 'User unblocked' });
  } catch (err) {
    res.status(500).json({ message: 'Could not unblock user', error: err.message });
  }
});

// POST /api/safety/report  { userId, reason, details }
router.post('/report', auth, async (req, res) => {
  try {
    const { userId, reason, details } = req.body;
    if (!userId) return res.status(400).json({ message: 'User is required' });
    await SafetyReport.create({
      reporter: req.user._id,
      reportedUser: userId,
      reason: reason || 'other',
      details: String(details || '').slice(0, 1000),
    });
    res.status(201).json({ message: 'Report submitted. Our moderators will review it.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit report', error: err.message });
  }
});

module.exports = router;
