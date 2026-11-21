const express = require('express');
const ExamCenter = require('../models/ExamCenter');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/centers  — add a missing center (verified students can contribute)
router.post('/', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 120);
    const city = String(req.body.city || '').trim().slice(0, 60);
    if (!name || !city) {
      return res.status(400).json({ message: 'Center name and city are required' });
    }
    // reuse an existing case-insensitive match instead of creating a duplicate
    const existing = await ExamCenter.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (existing) return res.json({ center: existing, existed: true });

    const center = await ExamCenter.create({
      name,
      city,
      code: String(req.body.code || '').trim().slice(0, 20),
      state: String(req.body.state || '').trim().slice(0, 40),
      address: String(req.body.address || '').trim().slice(0, 200),
    });
    res.status(201).json({ center });
  } catch (err) {
    res.status(500).json({ message: 'Could not add center', error: err.message });
  }
});

// GET /api/centers/search?q=  — search centers by name / city / code
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ centers: [] });
    }
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const centers = await ExamCenter.find({
      $or: [{ name: regex }, { city: regex }, { code: regex }],
    })
      .limit(15)
      .sort({ city: 1, name: 1 });
    res.json({ centers });
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// GET /api/centers/:id/students  — verified students at the same center AND same exam (excluding self + blocked)
router.get('/:id/students', auth, async (req, res) => {
  try {
    // a student only matches others with the SAME exam — same center alone is not enough
    if (!req.user.exam) {
      return res.json({ students: [] });
    }
    const examRegex = new RegExp(
      `^${String(req.user.exam).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    );
    const blocked = req.user.blockedUsers || [];
    const students = await User.find({
      examCenter: req.params.id,
      exam: examRegex,
      _id: { $ne: req.user._id, $nin: blocked },
      verificationStatus: { $in: ['verified', 'profile_pending'] },
      isBanned: false,
    })
      .select('name gender homeCity exam examDate avatarColor verificationStatus createdAt')
      .limit(100);
    res.json({ students });
  } catch (err) {
    res.status(500).json({ message: 'Could not load students', error: err.message });
  }
});

// GET /api/centers/:id  — center detail
router.get('/:id', async (req, res) => {
  try {
    const center = await ExamCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ message: 'Center not found' });
    const studentCount = await User.countDocuments({ examCenter: center._id, isBanned: false });
    res.json({ center, studentCount });
  } catch (err) {
    res.status(500).json({ message: 'Could not load center', error: err.message });
  }
});

module.exports = router;
