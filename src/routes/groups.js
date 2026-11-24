const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const { auth } = require('../middleware/auth');

const router = express.Router();

const GROUP_COLORS = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];

async function isMember(groupId, userId) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) return null;
  const g = await Group.findOne({ _id: groupId, members: userId }).select('_id admin');
  return g || null;
}

function validIds(ids) {
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
}

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

// POST /api/groups { name, memberIds } — create a group with connected students
router.post('/', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const memberIds = validIds(
      Array.isArray(req.body.memberIds) ? [...new Set(req.body.memberIds)] : []
    );

    if (!name) return res.status(400).json({ message: 'Group name is required' });

    if (memberIds.length > 0) {
      const checks = await Promise.all(memberIds.map((id) => areFriends(req.user._id, id)));
      const notFriends = memberIds.filter((_, i) => !checks[i]);
      if (notFriends.length > 0) {
        return res
          .status(403)
          .json({ message: 'You can only add students you are connected with' });
      }
    }

    const members = [req.user._id, ...memberIds];
    const group = await Group.create({
      name: name.slice(0, 50),
      admin: req.user._id,
      createdBy: req.user._id,
      members,
      avatarColor: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)],
    });

    await Message.create({
      sender: req.user._id,
      group: group._id,
      text: `${req.user.name || 'A student'} created group “${group.name}”`,
      system: true,
    });

    res.status(201).json({ group });
  } catch (err) {
    res.status(500).json({ message: 'Could not create group', error: err.message });
  }
});

// GET /api/groups — my groups with last message + unread count
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('admin', 'name')
      .populate('members', 'name avatarColor exam examDate examTime')
      .sort({ updatedAt: -1 });

    const withMeta = [];
    for (const g of groups) {
      const last = await Message.findOne({ group: g._id })
        .sort({ createdAt: -1 })
        .populate('sender', 'name');
      const unread = await Message.countDocuments({
        group: g._id,
        sender: { $ne: req.user._id },
        readAt: null,
      });
      withMeta.push({
        group: g,
        lastMessage: last
          ? {
              text: last.text,
              createdAt: last.createdAt,
              sender: last.sender?._id || last.sender,
              senderName: last.sender?.name || null,
              system: last.system,
            }
          : null,
        unread,
      });
    }
    res.json({ groups: withMeta });
  } catch (err) {
    res.status(500).json({ message: 'Could not load groups', error: err.message });
  }
});

// GET /api/groups/:id — group details (members)
router.get('/:id', auth, async (req, res) => {
  try {
    const membership = await isMember(req.params.id, req.user._id);
    if (!membership) return res.status(403).json({ message: 'You are not in this group' });
    const group = await Group.findById(req.params.id)
      .populate('admin', 'name')
      .populate('members', 'name avatarColor exam examDate examTime');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json({ group });
  } catch (err) {
    res.status(500).json({ message: 'Could not load group', error: err.message });
  }
});

// GET /api/groups/:id/messages — full group chat (marks incoming as read)
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const groupId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }
    if (!(await isMember(groupId, req.user._id))) {
      return res.status(403).json({ message: 'You are not in this group' });
    }
    await Message.updateMany(
      { group: groupId, sender: { $ne: req.user._id }, readAt: null },
      { $set: { readAt: new Date() } }
    );
    const messages = await Message.find({ group: groupId })
      .populate('sender', 'name avatarColor')
      .sort({ createdAt: 1 })
      .limit(300);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'Could not load messages', error: err.message });
  }
});

// POST /api/groups/:id/messages { text }
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Message is empty' });
    if (!(await isMember(groupId, req.user._id))) {
      return res.status(403).json({ message: 'You are not in this group' });
    }
    const message = await Message.create({
      sender: req.user._id,
      group: groupId,
      text: text.slice(0, 2000),
    });
    await Group.findByIdAndUpdate(groupId, { updatedAt: new Date() });
    res.status(201).json({ message: { ...message.toJSON(), sender: { _id: req.user._id, name: req.user.name } } });
  } catch (err) {
    res.status(500).json({ message: 'Could not send message', error: err.message });
  }
});

// POST /api/groups/:id/members { memberIds } — add connected students to the group
router.post('/:id/members', auth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const memberIds = validIds(
      Array.isArray(req.body.memberIds) ? [...new Set(req.body.memberIds)] : []
    );
    if (memberIds.length === 0) return res.status(400).json({ message: 'No students selected' });

    const membership = await isMember(groupId, req.user._id);
    if (!membership) return res.status(403).json({ message: 'You are not in this group' });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const checks = await Promise.all(memberIds.map((id) => areFriends(req.user._id, id)));
    const notFriends = memberIds.filter((_, i) => !checks[i]);
    if (notFriends.length > 0) {
      return res.status(403).json({ message: 'You can only add students you are connected with' });
    }

    const newIds = memberIds.filter(
      (id) => !group.members.some((m) => m.equals(id))
    );
    if (newIds.length === 0) {
      return res.status(400).json({ message: 'Already in the group' });
    }

    group.members.push(...newIds);
    await group.save();

    const added = await Promise.all(
      newIds.map((id) => require('../models/User').findById(id).select('name'))
    );
    const names = added.map((u) => u?.name || 'a student').join(', ');
    await Message.create({
      sender: req.user._id,
      group: groupId,
      text: `${req.user.name || 'A student'} added ${names}`,
      system: true,
    });
    await Group.findByIdAndUpdate(groupId, { updatedAt: new Date() });

    res.json({ group });
  } catch (err) {
    res.status(500).json({ message: 'Could not add members', error: err.message });
  }
});

// POST /api/groups/:id/leave — leave the group
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    group.members = group.members.filter((m) => !m.equals(req.user._id));
    if (group.members.length === 0) {
      await Message.deleteMany({ group: groupId });
      await group.deleteOne();
      return res.json({ group: null, deleted: true });
    }
    if (group.admin && group.admin.equals(req.user._id)) {
      group.admin = group.members[0];
    }
    await group.save();

    await Message.create({
      sender: req.user._id,
      group: groupId,
      text: `${req.user.name || 'A student'} left`,
      system: true,
    });
    res.json({ group });
  } catch (err) {
    res.status(500).json({ message: 'Could not leave group', error: err.message });
  }
});

module.exports = router;
