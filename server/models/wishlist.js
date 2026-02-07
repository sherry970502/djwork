const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['近期目标', '已实现'],
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引
wishlistSchema.index({ order: 1 });
wishlistSchema.index({ category: 1 });
wishlistSchema.index({ status: 1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
