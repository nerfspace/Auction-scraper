const express = require('express');
const app = express();
const crypto = require('crypto');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

app.use(express.json());
app.use(express.text());

// Import services
const ebayService = require("./services/ebayService");
const valuationService = require("./services/valuationService");
const profitCalculator = require("./utils/profitCalculator");
const Listing = require("./models/Listing");
const listingsRouter = require("./routes/listings");

// ----------------------
// DATABASE CONNECTION
// ----------------------
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
  console.warn('⚠️  MONGODB_URI not set – database features disabled');
}

// ----------------------
// API ROUTES
// ----------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/listings', apiLimiter, listingsRouter);

// GET /api/deals - Retrieve only profitable deals (profit > 20, roi > 0.5)
app.get('/api/deals', apiLimiter, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  try {
    const deals = await Listing.find({ profit: { $gt: 20 }, roi: { $gt: 0.5 } })
      .sort({ profit: -1 });
    res.json({ success: true, count: deals.length, data: deals });
  } catch (error) {
    console.error('GET /api/deals error:', error);
    res.status(500).json({ error: 'Failed to retrieve deals' });
  }
});

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.send("Auction Arbitrage Engine Running");
});

// ----------------------
// /notification → eBay Marketplace Account Deletion Compliance
// ----------------------
app.all("/notification", (req, res) => {
  console.log("📬 eBay Notification received");
  
  const challengeCode = req.query.challenge_code;
  const endpoint = 'https://auction-scraper-tey5.onrender.com/notification';
  const verificationToken = 'auction-scraper-ebay-compliance-verification-token-2026';
  
  if (challengeCode) {
    console.log("✅ Challenge code received:", challengeCode);
    
    // Hash: challengeCode + verificationToken + endpoint (in order)
    const hash = crypto.createHash('sha256');
    hash.update(challengeCode);
    hash.update(verificationToken);
    hash.update(endpoint);
    const responseHash = hash.digest('hex');
    
    console.log("✅ Sending challenge response:", responseHash);
    res.set('Content-Type', 'application/json');
    res.status(200).json({
      challengeResponse: responseHash
    });
  } else {
    // Normal notification acknowledgment
    res.status(200).json({ statusCode: 200 });
  }
});

// ----------------------
// /debug-token → Check if OAuth token works
// ----------------------
app.get("/debug-token", async (req, res) => {
  try {
    const CLIENT_ID = process.env.EBAY_CLIENT_ID;
    const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

    console.log('CLIENT_ID:', CLIENT_ID ? 'Set ✓' : 'NOT SET ✗');
    console.log('CLIENT_SECRET:', CLIENT_SECRET ? 'Set ✓' : 'NOT SET ✗');

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    const data = await response.json();
    
    res.json({
      status: response.status,
      hasToken: !!data.access_token,
      expiresIn: data.expires_in,
      errorMessage: data.error_description || 'None'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// /scan → Raw auction data
// ----------------------
app.get("/scan", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const auctions = await ebayService.searchAuctions(query);

    // Persist results to database when MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      const saveOps = auctions.map(item =>
        Listing.findOneAndUpdate(
          { itemId: item.itemId },
          { $set: { ...item, source: 'eBay' } },
          { upsert: true, new: true, runValidators: true }
        ).catch(err => console.error('Failed to save listing:', err))
      );
      await Promise.all(saveOps);
    }

    res.json({
      success: true,
      count: auctions.length,
      data: auctions
    });

  } catch (error) {
    console.error("SCAN ERROR:", error);
    res.status(500).json({ error: "Failed to scan auctions" });
  }
});

// ----------------------
// /opportunities → filtered profitable deals
// ----------------------
app.get("/opportunities", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    // 1. Get auctions
    const auctions = await ebayService.searchAuctions(query);

    // 2. Analyze value
    const analyzed = await valuationService.analyzeOpportunities(auctions);

    // 3. Add profit calculations
    const withProfit = analyzed.map(item => {
      const profitData = profitCalculator.calculate(item);

      return {
        ...item,
        ...profitData
      };
    });

    // 4. Filter only GOOD deals
    const deals = withProfit.filter(item =>
      item.profit > 20 && item.roi > 0.5
    );

    // 5. Sort best first
    deals.sort((a, b) => b.profit - a.profit);

    // 6. Persist deals to database when MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      const saveOps = withProfit.map(item =>
        Listing.findOneAndUpdate(
          { itemId: item.itemId },
          { $set: { ...item, source: 'eBay' } },
          { upsert: true, new: true, runValidators: true }
        ).catch(err => console.error('Failed to save opportunity:', err))
      );
      await Promise.all(saveOps);
    }

    res.json({
      success: true,
      total_scanned: auctions.length,
      opportunities_found: deals.length,
      data: deals
    });

  } catch (error) {
    console.error("OPPORTUNITY ERROR:", error);
    res.status(500).json({ error: "Failed to analyze opportunities" });
  }
});

// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
