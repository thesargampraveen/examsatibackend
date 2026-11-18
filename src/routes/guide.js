const express = require('express');
const GuideTip = require('../models/GuideTip');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/guide/:centerId — tips shared by students for this center
router.get('/:centerId', auth, async (req, res) => {
  try {
    const tips = await GuideTip.find({ center: req.params.centerId })
      .populate('author', 'name avatarColor')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ tips: tips.filter((t) => t.author) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load guide', error: err.message });
  }
});

// POST /api/guide/:centerId  { category, text }
router.post('/:centerId', auth, async (req, res) => {
  try {
    const { category, text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Tip text is required' });
    }
    const tip = await GuideTip.create({
      center: req.params.centerId,
      author: req.user._id,
      category: category || 'other',
      text: String(text).trim().slice(0, 1000),
    });
    res.status(201).json({ tip });
  } catch (err) {
    res.status(500).json({ message: 'Could not save tip', error: err.message });
  }
});

// DELETE /api/guide/tip/:id — author can delete their own tip
router.delete('/tip/:id', auth, async (req, res) => {
  try {
    const tip = await GuideTip.findById(req.params.id);
    if (!tip) return res.status(404).json({ message: 'Tip not found' });
    if (!tip.author.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own tips' });
    }
    await tip.deleteOne();
    res.json({ message: 'Tip deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete tip', error: err.message });
  }
});

module.exports = router;
