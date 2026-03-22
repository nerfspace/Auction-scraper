const express = require('express');
const app = express();
const crypto = require('crypto');
const path = require('path');

app.use(express.json());
app.use(express.static('public'));
app.use(express.text());

// Import services
const ebayService = require("./services/ebayService");
const valuationService = require("./services/valuationService");
const profitCalculator = require("./utils/profitCalculator");
const analyticsService = require("./services/analyticsService");
const catalogService = require("./services/catalogService");
const pricingService = require("./services/pricingService");
const listingService = require("./services/listingService");
const inventoryService = require("./services/inventoryService");
const shippingService = require("./services/shippingService");
const returnsService = require("./services/returnsService");

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------
// OPPORTUNITIES ENDPOINT
// ----------------------
app.get("/opportunities", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const auctions = await ebayService.searchAuctions(query);
    console.log(`OPPORTUNITIES: found ${auctions.length} auctions for "${query}"`);

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
  console.log(`Server running on port ${PORT}`);
});
