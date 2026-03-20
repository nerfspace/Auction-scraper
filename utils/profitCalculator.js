function calculateProfit(sellingPrice, purchasePrice, shippingCost) {
    const ebayFee = sellingPrice * 0.10; // eBay fee is typically 10%
    const paypalFee = sellingPrice * 0.029 + 0.30; // PayPal fee is 2.9% + $0.30
    const totalFees = ebayFee + paypalFee + shippingCost;
    const profitMargin = (sellingPrice - purchasePrice - totalFees) / sellingPrice * 100; // Profit margin in percentage
    return profitMargin;
}

module.exports = calculateProfit;