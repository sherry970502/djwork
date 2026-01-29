const mongoose = require('mongoose');

const designDimensionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  // 维度分类
  category: {
    type: String,
    default: '其他'
  },
  // 该维度下的思考角度和提示
  prompts: [{
    type: String
  }],
  // 该维度下的参考案例
  examples: [{
    title: String,
    description: String
  }],
  // 维度图标颜色
  color: {
    type: String,
    default: '#667eea'
  },
  // 维度图标
  icon: {
    type: String,
    default: 'bulb'
  },
  // 是否启用
  isActive: {
    type: Boolean,
    default: true
  },
  // 排序权重
  sortOrder: {
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

designDimensionSchema.index({ name: 1 });
designDimensionSchema.index({ sortOrder: 1 });

module.exports = mongoose.model('DesignDimension', designDimensionSchema);
