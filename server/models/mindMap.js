const mongoose = require('mongoose');

const mindMapNodeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  parentId: {
    type: String,
    default: null
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  isMarked: {
    type: Boolean,
    default: false
  },
  isAIGenerated: {
    type: Boolean,
    default: false
  },
  level: {
    type: Number,
    default: 0
  },
  divergenceType: {
    type: String,
    enum: ['horizontal', 'vertical', 'root'],
    default: 'root'
  }
});

const mindMapSchema = new mongoose.Schema({
  designId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalDesign',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  nodes: [mindMapNodeSchema],
  edges: [{
    source: { type: String, required: true },
    target: { type: String, required: true }
  }],
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时间戳
mindMapSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('MindMap', mindMapSchema);
