const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#1890ff'
  },
  keywords: [{
    type: String,
    trim: true
  }],
  thoughtCount: {
    type: Number,
    default: 0
  },
  isPreset: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
tagSchema.index({ name: 1 });
tagSchema.index({ thoughtCount: -1 });

module.exports = mongoose.model('Tag', tagSchema);
