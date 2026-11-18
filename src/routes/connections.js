const express = require('express');
const Connection = require('../models/Connection');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/connections  { userId }  — send a connect request
router.post('/', auth, async (req, res) => {
  try {
    const target = await User.findById(req.body.userId);
    if (!target || target.isBanned) {
      return res.status(404).json({ message: 'Student not found' });
    }
    if (target._id.equals(req.user._id)) {
      return res.status(400).json({ message: 'You cannot connect with yourself' });
    }
    if ((req.user.blockedUsers || []).some((id) => id.equals(target._id))) {
      return res.status(400).json({ message: 'Unblock this student first' });
    }

    const existing = await Connection.findOne({
      $or: [
        { requester: req.user._id, recipient: target._id },
        { requester: target._id, recipient: req.user._id },
      ],
    });
    if (existing) {
      return res.json({ connection: existing, message: 'Request already exists' });
    }

    const connection = await Connection.create({
      requester: req.user._id,
      recipient: target._id,
    });
    res.status(201).json({ connection });
  } catch (err) {
    res.status(500).json({ message: 'Could not send request', error: err.message });
  }
});

// GET /api/connections/requests  — incoming pending requests
router.get('/requests', auth, async (req, res) => {
  try {
    const requests = await Connection.find({
      recipient: req.user._id,
      status: 'pending',
    }).populate('requester', 'name gender homeCity exam avatarColor verificationStatus');
    res.json({ requests: requests.filter((r) => r.requester) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load requests', error: err.message });
  }
});

// GET /api/connections/friends — accepted connections
router.get('/friends', auth, async (req, res) => {
  try {
    const connections = await Connection.find({
      status: 'accepted',
      $or: [{ requester: req.user._id }, { recipient: req.user._id }],
    }).populate('requester recipient', 'name gender homeCity exam examDate avatarColor');

    const friends = connections
      .map((c) => {
        const friend = c.requester._id.equals(req.user._id) ? c.recipient : c.requester;
        return { connectionId: c._id, friend, since: c.updatedAt };
      })
      .filter((f) => f.friend);
    res.json({ friends });
  } catch (err) {
    res.status(500).json({ message: 'Could not load friends', error: err.message });
  }
});

// POST /api/connections/:id/accept
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection || !connection.recipient.equals(req.user._id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    connection.status = 'accepted';
    await connection.save();
    res.json({ connection });
  } catch (err) {
    res.status(500).json({ message: 'Could not accept request', error: err.message });
  }
});

// POST /api/connections/:id/decline
router.post('/:id/decline', auth, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.id);
    if (!connection || !connection.recipient.equals(req.user._id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    connection.status = 'declined';
    await connection.save();
    res.json({ connection });
  } catch (err) {
    res.status(500).json({ message: 'Could not decline request', error: err.message });
  }
});

module.exports = router;
