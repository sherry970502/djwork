const mongoose = require('mongoose');

const agentConversationSchema = new mongoose.Schema({
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    toolCalls: [{
      toolName: String,
      result: mongoose.Schema.Types.Mixed
    }],
    blocks: [{
      type: mongoose.Schema.Types.Mixed
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 只保留最近的对话记录（最多保存最近100条消息）
agentConversationSchema.pre('save', function(next) {
  if (this.messages.length > 100) {
    this.messages = this.messages.slice(-100);
  }
  this.lastActiveAt = new Date();
  next();
});

module.exports = mongoose.model('AgentConversation', agentConversationSchema);
