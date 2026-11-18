const express = require('express');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const { auth } = require('../middleware/auth');

const router = express.Router();

async function areFriends(a, b) {
  const c = await Connection.findOne({
    status: 'accepted',
    $or: [
      { requester: a, recipient: b },
      { requester: b, recipient: a },
    ],
  });
  return !!c;
}

// GET /api/chat/threads — list of friends with last message + unread count
router.get('/threads', auth, async (req, res) => {
  try {
    const connections = await Connection.find({
      status: 'accepted',
      $or: [{ requester: req.user._id }, { recipient: req.user._id }],
    }).populate('requester recipient', 'name avatarColor exam examDate');

    const threads = [];
    for (const c of connections) {
      const friend = c.requester._id.equals(req.user._id) ? c.recipient : c.requester;
      if (!friend) continue;
      const last = await Message.findOne({
        $or: [
          { sender: req.user._id, recipient: friend._id },
          { sender: friend._id, recipient: req.user._id },
        ],
      }).sort({ createdAt: -1 });
      const unread = await Message.countDocuments({
        sender: friend._id,
        recipient: req.user._id,
        readAt: null,
      });
      threads.push({
        friend,
        lastMessage: last ? { text: last.text, createdAt: last.createdAt, sender: last.sender } : null,
        unread,
      });
    }
    threads.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });
    res.json({ threads });
  } catch (err) {
    res.status(500).json({ message: 'Could not load chats', error: err.message });
  }
});

// GET /api/chat/:friendId  — full conversation (marks incoming as read)
router.get('/:friendId', auth, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    if (!(await areFriends(req.user._id, friendId))) {
      return res.status(403).json({ message: 'Connect with this student before chatting' });
    }
    await Message.updateMany(
      { sender: friendId, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: friendId },
        { sender: friendId, recipient: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(300);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Could not load messages', error: err.message });
  }
});

// POST /api/chat/:friendId  { text }
router.post('/:friendId', auth, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Message is empty' });
    if (!(await areFriends(req.user._id, friendId))) {
      return res.status(403).json({ message: 'Connect with this student before chatting' });
    }
    const message = await Message.create({
      sender: req.user._id,
      recipient: friendId,
      text: text.slice(0, 2000),
    });
    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ message: 'Could not send message', error: err.message });
  }
});

module.exports = router;
