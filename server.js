const express = require("express");
const app = express();

app.use(express.json());

// Import services
const ebayService = require("./services/ebayService");
const valuationService = require("./services/valuationService");
const profitCalculator = require("./utils/profitCalculator");


// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.send("Auction Arbitrage Engine Running");
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
    
    const response = await fetch('https://api.sandbox.ebay.com/identity/v1/oauth2/token', {
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
// /debug → Check eBay API raw response
// ----------------------
app.get("/debug", async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const response = await fetch(`https://api.sandbox.ebay.com/buy/browse/v1/item_search?q=${encodeURIComponent(query)}&limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.EBAY_AUTH_TOKEN}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: data
    });

  } catch (error) {
    console.error("DEBUG ERROR:", error);
    res.status(500).json({ error: error.message });
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
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
