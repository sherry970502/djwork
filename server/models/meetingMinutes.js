const mongoose = require('mongoose');

const meetingMinutesSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  meetingDate: {
    type: Date,
    default: Date.now
  },
  content: {
    type: String,
    required: true
  },
  sourceType: {
    type: String,
    enum: ['paste', 'word', 'pdf', 'txt'],
    default: 'paste'
  },
  originalFileName: {
    type: String,
    default: null
  },
  processStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processError: {
    type: String,
    default: null
  },
  thoughtCount: {
    type: Number,
    default: 0
  },
  processedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
meetingMinutesSchema.index({ meetingDate: -1 });
meetingMinutesSchema.index({ processStatus: 1 });
meetingMinutesSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MeetingMinutes', meetingMinutesSchema);
