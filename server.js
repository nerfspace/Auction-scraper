const express = require('express');
const app = express();
const crypto = require('crypto');
const path = require('path');

app.use(express.json());
app.use(express.static('public'));
app.use(express.text());

// Import core services (required)
const ebayService = require("./services/ebayService");
const valuationService = require("./services/valuationService");
const profitCalculator = require("./utils/profitCalculator");

// Import optional services with error handling
let analyticsService, catalogService, pricingService, listingService, inventoryService, shippingService, returnsService;

try {
  analyticsService = require("./services/analyticsService");
} catch (e) {
  console.warn('⚠️ Analytics service not available');
  analyticsService = null;
}

try {
  catalogService = require("./services/catalogService");
} catch (e) {
  console.warn('⚠️ Catalog service not available');
  catalogService = null;
}

try {
  pricingService = require("./services/pricingService");
} catch (e) {
  console.warn('⚠️ Pricing service not available');
  pricingService = null;
}

try {
  listingService = require("./services/listingService");
} catch (e) {
  console.warn('⚠️ Listing service not available');
  listingService = null;
}

try {
  inventoryService = require("./services/inventoryService");
} catch (e) {
  console.warn('⚠️ Inventory service not available');
  inventoryService = null;
}

try {
  shippingService = require("./services/shippingService");
} catch (e) {
  console.warn('⚠️ Shipping service not available');
  shippingService = null;
}

try {
  returnsService = require("./services/returnsService");
} catch (e) {
  console.warn('⚠️ Returns service not available');
  returnsService = null;
}

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    console.log(`SCAN: found ${auctions.length} auctions for "${query}"`);

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
// /opportunities → filtered profitable deals WITH PROFIT CALCULATION
// ----------------------
app.get("/opportunities", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const auctions = await ebayService.searchAuctions(query);
    console.log(`\n📊 OPPORTUNITIES: found ${auctions.length} auctions for "${query}"`);

    const withProfit = auctions.map(item => {
      const profitData = profitCalculator.calculate(item);
      
      return {
        ...item,
        profit: profitData.profit,
        roi: profitData.roi,
        fees: profitData.fees,
        estimatedValue: profitData.estimatedSelling
      };
    });

    const deals = withProfit.filter(item => item.profit > 0);
    deals.sort((a, b) => b.profit - a.profit);

    console.log(`✅ OPPORTUNITIES: ${deals.length} profitable deals found\n`);

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
// ANALYTICS ENDPOINTS
// ----------------------
app.get("/api/analytics/trends", async (req, res) => {
  if (!analyticsService) {
    return res.status(503).json({ error: "Analytics service not available" });
  }

  try {
    const { keyword, categoryId } = req.query;

    if (!keyword) {
      return res.status(400).json({ error: "Missing keyword" });
    }

    const trends = await analyticsService.getTrendingKeywords(keyword, categoryId);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error("ANALYTICS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ----------------------
// CATALOG ENDPOINTS
// ----------------------
app.get("/api/catalog/search", async (req, res) => {
  if (!catalogService) {
    return res.status(503).json({ error: "Catalog service not available" });
  }

  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const products = await catalogService.searchProducts(q);

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error("CATALOG ERROR:", error);
    res.status(500).json({ error: "Failed to search catalog" });
  }
});

app.get("/api/catalog/product/:id", async (req, res) => {
  if (!catalogService) {
    return res.status(503).json({ error: "Catalog service not available" });
  }

  try {
    const { id } = req.params;

    const product = await catalogService.getProductDetails(id);

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error("CATALOG ERROR:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

// ----------------------
// PRICING ENDPOINTS
// ----------------------
app.get("/api/pricing/item/:itemId", async (req, res) => {
  if (!pricingService) {
    return res.status(503).json({ error: "Pricing service not available" });
  }

  try {
    const { itemId } = req.params;

    const pricing = await pricingService.getItemPricing(itemId);

    res.json({
      success: true,
      data: pricing
    });

  } catch (error) {
    console.error("PRICING ERROR:", error);
    res.status(500).json({ error: "Failed to fetch pricing" });
  }
});

app.post("/api/pricing/bulk", async (req, res) => {
  if (!pricingService) {
    return res.status(503).json({ error: "Pricing service not available" });
  }

  try {
    const { requests } = req.body;

    if (!requests) {
      return res.status(400).json({ error: "Missing requests" });
    }

    const pricing = await pricingService.getBulkPricing(requests);

    res.json({
      success: true,
      data: pricing
    });

  } catch (error) {
    console.error("PRICING ERROR:", error);
    res.status(500).json({ error: "Failed to fetch bulk pricing" });
  }
});

// ----------------------
// LISTING ENDPOINTS
// ----------------------
app.post("/api/listing/create", async (req, res) => {
  if (!listingService) {
    return res.status(503).json({ error: "Listing service not available" });
  }

  try {
    const listingData = req.body;

    const result = await listingService.createFixedPriceListing(listingData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("LISTING ERROR:", error);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

app.put("/api/listing/:itemId", async (req, res) => {
  if (!listingService) {
    return res.status(503).json({ error: "Listing service not available" });
  }

  try {
    const { itemId } = req.params;
    const updateData = req.body;

    const result = await listingService.updateListing(itemId, updateData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("LISTING ERROR:", error);
    res.status(500).json({ error: "Failed to update listing" });
  }
});

app.delete("/api/listing/:itemId", async (req, res) => {
  if (!listingService) {
    return res.status(503).json({ error: "Listing service not available" });
  }

  try {
    const { itemId } = req.params;

    const result = await listingService.deleteListing(itemId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("LISTING ERROR:", error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

// ----------------------
// INVENTORY ENDPOINTS
// ----------------------
app.get("/api/inventory/:sku", async (req, res) => {
  if (!inventoryService) {
    return res.status(503).json({ error: "Inventory service not available" });
  }

  try {
    const { sku } = req.params;

    const inventory = await inventoryService.getInventoryItem(sku);

    res.json({
      success: true,
      data: inventory
    });

  } catch (error) {
    console.error("INVENTORY ERROR:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

app.post("/api/inventory/:sku", async (req, res) => {
  if (!inventoryService) {
    return res.status(503).json({ error: "Inventory service not available" });
  }

  try {
    const { sku } = req.params;
    const itemData = req.body;

    const result = await inventoryService.createInventoryItem(sku, itemData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("INVENTORY ERROR:", error);
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

app.put("/api/inventory/:sku/quantity", async (req, res) => {
  if (!inventoryService) {
    return res.status(503).json({ error: "Inventory service not available" });
  }

  try {
    const { sku } = req.params;
    const { quantity } = req.body;

    const result = await inventoryService.updateInventoryQuantity(sku, quantity);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("INVENTORY ERROR:", error);
    res.status(500).json({ error: "Failed to update inventory quantity" });
  }
});

// ----------------------
// SHIPPING ENDPOINTS
// ----------------------
app.get("/api/shipping/order/:orderId", async (req, res) => {
  if (!shippingService) {
    return res.status(503).json({ error: "Shipping service not available" });
  }

  try {
    const { orderId } = req.params;

    const shipping = await shippingService.getShippingQuote(orderId);

    res.json({
      success: true,
      data: shipping
    });

  } catch (error) {
    console.error("SHIPPING ERROR:", error);
    res.status(500).json({ error: "Failed to fetch shipping info" });
  }
});

app.post("/api/shipping/order/:orderId/shipment", async (req, res) => {
  if (!shippingService) {
    return res.status(503).json({ error: "Shipping service not available" });
  }

  try {
    const { orderId } = req.params;
    const shipmentData = req.body;

    const result = await shippingService.createShipment(orderId, shipmentData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("SHIPPING ERROR:", error);
    res.status(500).json({ error: "Failed to create shipment" });
  }
});

// ----------------------
// RETURNS ENDPOINTS
// ----------------------
app.get("/api/returns", async (req, res) => {
  if (!returnsService) {
    return res.status(503).json({ error: "Returns service not available" });
  }

  try {
    const returns = await returnsService.getReturnRequests();

    res.json({
      success: true,
      data: returns
    });

  } catch (error) {
    console.error("RETURNS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
});

app.post("/api/returns/:returnId/approve", async (req, res) => {
  if (!returnsService) {
    return res.status(503).json({ error: "Returns service not available" });
  }

  try {
    const { returnId } = req.params;
    const approvalData = req.body;

    const result = await returnsService.approveReturn(returnId, approvalData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("RETURNS ERROR:", error);
    res.status(500).json({ error: "Failed to approve return" });
  }
});

app.post("/api/returns/:returnId/refund", async (req, res) => {
  if (!returnsService) {
    return res.status(503).json({ error: "Returns service not available" });
  }

  try {
    const { returnId } = req.params;
    const refundData = req.body;

    const result = await returnsService.processRefund(returnId, refundData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("RETURNS ERROR:", error);
    res.status(500).json({ error: "Failed to process refund" });
  }
});

// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Core services: ✓ eBay Search, ✓ Valuation, ✓ Profit Calculator`);
  console.log(`📈 Optional services: ${analyticsService ? '✓' : '✗'} Analytics, ${catalogService ? '✓' : '✗'} Catalog, ${pricingService ? '✓' : '✗'} Pricing, ${listingService ? '✓' : '✗'} Listing, ${inventoryService ? '✓' : '✗'} Inventory, ${shippingService ? '✓' : '✗'} Shipping, ${returnsService ? '✓' : '✗'} Returns`);
});
