const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // 基本信息
  name: {
    type: String,
    required: true,
    trim: true
  },
  purpose: {
    type: String,
    trim: true
  },
  description: {
    type: String
  },

  // 树形结构
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  path: {
    type: String,
    default: ''
  }, // 存储完整路径，如 "/root/parent/current"，便于查询

  // 状态管理
  status: {
    type: String,
    enum: ['conception', 'planning', 'active', 'paused', 'completed', 'archived'],
    default: 'conception'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },

  // 内容
  coverImage: {
    type: String
  },
  content: {
    type: String
  },
  images: [{
    type: String
  }],
  links: [{
    url: String,
    title: String
  }],

  // 关联
  relatedThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  relatedDesigns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalDesign'
  }],

  // 从 PersonalDesign 同步而来
  syncedFromDesign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalDesign',
    default: null
  },

  // 元信息
  order: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
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
projectSchema.index({ parentId: 1, order: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ level: 1 });
projectSchema.index({ path: 1 });
projectSchema.index({ syncedFromDesign: 1 });

// 更新 path 的中间件
projectSchema.pre('save', async function(next) {
  if (this.isModified('parentId') || this.isNew) {
    if (this.parentId) {
      const parent = await this.constructor.findById(this.parentId);
      if (parent) {
        this.level = parent.level + 1;
        this.path = `${parent.path}/${this._id}`;
      }
    } else {
      this.level = 0;
      this.path = `/${this._id}`;
    }
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
