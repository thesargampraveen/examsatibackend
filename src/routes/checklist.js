const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Item ids the client is allowed to store — keep in sync with HomeScreen CHECKLIST_ITEMS
const ALLOWED_ITEMS = ['admitCard', 'aadhar', 'photos', 'waterBottle'];

// GET /api/checklist — current user's ticked items
router.get('/', auth, (req, res) => {
  const items = {};
  for (const id of ALLOWED_ITEMS) {
    items[id] = req.user.examChecklist?.get?.(id) === true;
  }
  res.json({ items });
});

// PUT /api/checklist  { items: { admitCard: true, ... } } — save ticked items
router.put('/', auth, async (req, res) => {
  try {
    const incoming = req.body.items || {};
    const items = {};
    for (const id of ALLOWED_ITEMS) {
      if (id in incoming) items[id] = Boolean(incoming[id]);
    }
    req.user.examChecklist = items; // mongoose casts the plain object to a Map
    await req.user.save();
    const saved = {};
    for (const id of ALLOWED_ITEMS) saved[id] = req.user.examChecklist.get(id) === true;
    res.json({ items: saved });
  } catch (err) {
    res.status(500).json({ message: 'Could not save checklist', error: err.message });
  }
});

module.exports = router;
