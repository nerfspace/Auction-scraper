const profitCalculator = {
    calculate: function(item) {
        const currentBid = item.price?.value || 0;
        const estimatedValue = item.estimatedValue || (currentBid * 1.5);
        const shippingCost = 5; // Default shipping estimate
        
        const ebayFee = estimatedValue * 0.10;
        const paypalFee = estimatedValue * 0.029 + 0.30;
        const totalFees = ebayFee + paypalFee + shippingCost;
        
        const profit = estimatedValue - currentBid - totalFees;
        const roi = (profit / currentBid) * 100;
        
        return {
            profit: Math.max(0, profit),
            roi: Math.max(0, roi),
            fees: totalFees,
            estimatedSelling: estimatedValue
        };
    }
};

module.exports = profitCalculator;