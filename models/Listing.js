const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    condition: {
      type: String,
    },
    estimatedValue: {
      type: Number,
    },
    bidCount: {
      type: Number,
      default: 0,
    },
    profit: {
      type: Number,
    },
    roi: {
      type: Number,
    },
    fees: {
      type: Number,
    },
    estimatedSelling: {
      type: Number,
    },
    source: {
      type: String,
      default: 'eBay',
    },
  },
  {
    timestamps: true,
  }
);

listingSchema.index({ price: 1 });
listingSchema.index({ profit: 1 });
listingSchema.index({ roi: 1 });
listingSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Listing', listingSchema);
