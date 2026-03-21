const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Allowed fields for a listing to prevent mass assignment
const ALLOWED_FIELDS = [
  'itemId', 'title', 'price', 'condition', 'estimatedValue',
  'bidCount', 'profit', 'roi', 'fees', 'estimatedSelling', 'source'
];

function pickAllowedFields(obj) {
  const result = {};
  for (const key of ALLOWED_FIELDS) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildPriceFilter(minPrice, maxPrice) {
  const filter = {};
  const min = parseNumber(minPrice);
  const max = parseNumber(maxPrice);
  if (min !== null) filter.$gte = min;
  if (max !== null) filter.$lte = max;
  return Object.keys(filter).length > 0 ? filter : null;
}

// POST /api/listings - Save a listing to the database
router.post('/', async (req, res) => {
  try {
    const data = pickAllowedFields(req.body);

    if (!data.itemId || !data.title || data.price === undefined) {
      return res.status(400).json({ error: 'itemId, title, and price are required' });
    }

    const listing = await Listing.findOneAndUpdate(
      { itemId: data.itemId },
      { $set: data },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({ success: true, data: listing });
  } catch (error) {
    console.error('POST /api/listings error:', error);
    res.status(500).json({ error: 'Failed to save listing' });
  }
});

// GET /api/listings - Retrieve all listings with optional filters
router.get('/', async (req, res) => {
  try {
    const { minPrice, maxPrice, minProfit, condition } = req.query;
    const filter = {};

    const priceFilter = buildPriceFilter(minPrice, maxPrice);
    if (priceFilter) filter.price = priceFilter;

    const minProfitNum = parseNumber(minProfit);
    if (minProfitNum !== null) filter.profit = { $gte: minProfitNum };

    if (condition) filter.condition = condition;

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: listings.length, data: listings });
  } catch (error) {
    console.error('GET /api/listings error:', error);
    res.status(500).json({ error: 'Failed to retrieve listings' });
  }
});

// GET /api/listings/search - Search stored listings
router.get('/search', async (req, res) => {
  try {
    const { q, minPrice, maxPrice, minProfit, condition } = req.query;
    const filter = {};

    if (q) filter.title = { $regex: q, $options: 'i' };

    const priceFilter = buildPriceFilter(minPrice, maxPrice);
    if (priceFilter) filter.price = priceFilter;

    const minProfitNum = parseNumber(minProfit);
    if (minProfitNum !== null) filter.profit = { $gte: minProfitNum };

    if (condition) filter.condition = condition;

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: listings.length, data: listings });
  } catch (error) {
    console.error('GET /api/listings/search error:', error);
    res.status(500).json({ error: 'Failed to search listings' });
  }
});

// GET /api/listings/:itemId - Get a specific listing
router.get('/:itemId', async (req, res) => {
  try {
    const listing = await Listing.findOne({ itemId: req.params.itemId });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('GET /api/listings/:itemId error:', error);
    res.status(500).json({ error: 'Failed to retrieve listing' });
  }
});

// DELETE /api/listings/:itemId - Remove a listing
router.delete('/:itemId', async (req, res) => {
  try {
    const listing = await Listing.findOneAndDelete({ itemId: req.params.itemId });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json({ success: true, message: 'Listing deleted' });
  } catch (error) {
    console.error('DELETE /api/listings/:itemId error:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
