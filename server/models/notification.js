const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'monthly-review',      // 月末复盘提醒
      'monthly-start',       // 月初事务提醒
      'progress-warning',    // 进度预警
      'intelligence-daily'   // 每日情报
    ]
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  relatedLink: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  isProcessed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  metadata: {
    count: Number,           // 数量（如新情报数）
    monthYear: String,       // 相关月份 "2026-02"
    progress: Number,        // 进度百分比
    keywords: [String]       // 相关关键词
  },
  expiresAt: {
    type: Date,
    default: function() {
      // 默认30天后过期
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date;
    }
  }
}, {
  timestamps: true
});

// 索引
notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ type: 1 });

// 自动删除过期通知
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
