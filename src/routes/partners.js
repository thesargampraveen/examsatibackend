const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const annotateConnections = require('../utils/annotateConnections');

const router = express.Router();

function isBlocked(user, otherId) {
  return (user.blockedUsers || []).some((id) => id.equals(otherId));
}

// GET /api/partners/travel?from=&gender=  — students travelling from the same home city
router.get('/travel', auth, async (req, res) => {
  try {
    const from = String(req.query.from || req.user.homeCity || '').trim();
    const genderFilter = String(req.query.gender || ''); // '' | male | female | other

    if (!from) return res.json({ partners: [], city: '' });

    const query = {
      homeCity: new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      _id: { $ne: req.user._id },
      isBanned: false,
      verificationStatus: 'verified',
      examCenter: { $ne: null },
    };
    if (genderFilter) query.gender = genderFilter;

    const partners = await User.find(query)
      .select('name gender homeCity exam examCenter examDate examTime avatarColor')
      .populate('examCenter', 'name city')
      .limit(50)
      .lean();

    const visible = partners.filter((p) => !isBlocked(req.user, p._id));
    await annotateConnections(req.user._id, visible);
    res.json({ partners: visible, city: from });
  } catch (err) {
    res.status(500).json({ message: 'Could not load travel partners', error: err.message });
  }
});

// GET /api/partners/stay?gender=  — potential accommodation-sharing matches near the same center
router.get('/stay', auth, async (req, res) => {
  try {
    const genderFilter = String(req.query.gender || '');
    if (!req.user.examCenter) return res.json({ partners: [] });

    const query = {
      examCenter: req.user.examCenter,
      _id: { $ne: req.user._id },
      isBanned: false,
      verificationStatus: 'verified',
    };
    // gender-safe: default to same-gender matches
    query.gender = genderFilter || req.user.gender;

    const partners = await User.find(query)
      .select('name gender homeCity exam examDate examTime avatarColor')
      .limit(50)
      .lean();

    const visible = partners.filter((p) => !isBlocked(req.user, p._id));
    await annotateConnections(req.user._id, visible);
    res.json({ partners: visible });
  } catch (err) {
    res.status(500).json({ message: 'Could not load stay partners', error: err.message });
  }
});

module.exports = router;
