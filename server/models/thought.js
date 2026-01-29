const mongoose = require('mongoose');

const similarThoughtSchema = new mongoose.Schema({
  thoughtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought',
    required: true
  },
  similarity: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  status: {
    type: String,
    enum: ['pending', 'merged', 'dismissed'],
    default: 'pending'
  }
}, { _id: false });

const thoughtSchema = new mongoose.Schema({
  meetingMinutesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingMinutes',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  originalSegment: {
    type: String,
    default: ''
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  confidence: {
    type: Number,
    default: 0.8,
    min: 0,
    max: 1
  },
  embedding: {
    type: [Number],
    default: []
  },
  similarThoughts: [similarThoughtSchema],
  isImportant: {
    type: Boolean,
    default: false
  },
  mergedFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  isMerged: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
thoughtSchema.index({ meetingMinutesId: 1 });
thoughtSchema.index({ tags: 1 });
thoughtSchema.index({ isImportant: -1 });
thoughtSchema.index({ createdAt: -1 });
thoughtSchema.index({ 'similarThoughts.status': 1 });

module.exports = mongoose.model('Thought', thoughtSchema);
