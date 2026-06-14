const express = require('express');
const router = express.Router();
const Place = require('../models/Place');

// GET /api/places
// GET /api/places?type=country|state|city
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const places = await Place.find(filter).sort({ visitedDate: -1 });
    res.json(places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/places
// body: { type, name, countryCode, countryName, stateCode?, stateName?, lat?, lng?, visitedDate?, notes? }
router.post('/', async (req, res) => {
  try {
    const place = new Place(req.body);
    const saved = await place.save();
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This place is already on your map.' });
    }
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/places/:id
// Use this to update notes or the visited date for an existing place
router.put('/:id', async (req, res) => {
  try {
    const updated = await Place.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Place not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/places/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Place.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Place not found' });
    res.json({ message: 'Removed', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
