const express = require("express");
const app = express();

app.use(express.json());
app.use(express.text()); // Handle plain text responses

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
// /ebay-notification → Marketplace Account Deletion Compliance
// ----------------------
app.post("/ebay-notification", (req, res) => {
  try {
    console.log("📬 eBay POST Notification received");
    console.log("Body:", JSON.stringify(req.body));
    console.log("Headers:", req.headers);
    
    // eBay expects a 200 response with verificationToken in JSON
    res.status(200).json({
      statusCode: 200,
      verificationToken: "auction-scraper-ebay-compliance-verification-token-2026"
    });
  } catch (error) {
    console.error("POST Notification Error:", error);
    res.status(200).json({ 
      statusCode: 200,
      verificationToken: "auction-scraper-ebay-compliance-verification-token-2026"
    });
  }
});

app.get("/ebay-notification", (req, res) => {
  console.log("📬 eBay GET Notification received");
  console.log("Query params:", req.query);
  
  const challengeCode = req.query.challenge_code;
  
  if (challengeCode) {
    console.log("✅ Challenge code received:", challengeCode);
    // eBay expects us to echo back the challenge code
    res.status(200).send(challengeCode);
  } else {
    res.status(200).json({
      statusCode: 200,
      verificationToken: "auction-scraper-ebay-compliance-verification-token-2026"
    });
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
