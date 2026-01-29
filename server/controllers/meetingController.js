const { MeetingMinutes, Thought, Tag } = require('../models');
const fileParserService = require('../services/fileParserService');
const claudeService = require('../services/claudeService');
const similarityService = require('../services/similarityService');
const config = require('../config');
const fs = require('fs').promises;

// Get all meetings
exports.getMeetings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};

    if (status) {
      query.processStatus = status;
    }

    const meetings = await MeetingMinutes.find(query)
      .sort({ meetingDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await MeetingMinutes.countDocuments(query);

    res.json({
      success: true,
      data: meetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get meeting by ID
exports.getMeeting = async (req, res) => {
  try {
    const meeting = await MeetingMinutes.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Get associated thoughts
    const thoughts = await Thought.find({ meetingMinutesId: meeting._id })
      .populate('tags')
      .sort({ isImportant: -1, createdAt: 1 });

    res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        thoughts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create meeting from pasted text
exports.createMeeting = async (req, res) => {
  try {
    const { title, content, meetingDate } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const meeting = new MeetingMinutes({
      title,
      content: fileParserService.cleanContent(content),
      meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
      sourceType: 'paste',
      processStatus: 'pending'
    });

    await meeting.save();

    res.status(201).json({
      success: true,
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload meeting file
exports.uploadMeeting = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { title, meetingDate } = req.body;
    const { path: filePath, originalname, mimetype } = req.file;

    // Parse file content
    const { content, sourceType } = await fileParserService.parseFile(filePath, mimetype);

    // Create meeting record
    const meeting = new MeetingMinutes({
      title: title || originalname.replace(/\.[^/.]+$/, ''),
      content,
      meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
      sourceType,
      originalFileName: originalname,
      processStatus: 'pending'
    });

    await meeting.save();

    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.error('Failed to delete uploaded file:', e);
    }

    res.status(201).json({
      success: true,
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Process meeting with AI
exports.processMeeting = async (req, res) => {
  try {
    const meeting = await MeetingMinutes.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    if (meeting.processStatus === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Meeting is already being processed'
      });
    }

    // Update status to processing
    meeting.processStatus = 'processing';
    meeting.processError = null;
    await meeting.save();

    // Start async processing
    processAsync(meeting._id).catch(error => {
      console.error('Async processing error:', error);
    });

    res.json({
      success: true,
      message: 'Processing started',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Async processing function
async function processAsync(meetingId) {
  const meeting = await MeetingMinutes.findById(meetingId);
  if (!meeting) return;

  try {
    // Get all tags
    const tags = await Tag.find();

    // Split content into chunks
    const chunks = fileParserService.splitIntoChunks(
      meeting.content,
      config.chunkSize,
      config.chunkOverlap
    );

    console.log(`Processing ${chunks.length} chunks for meeting: ${meeting.title}`);

    // Process each chunk
    let allThoughts = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      const extractedThoughts = await claudeService.extractThoughts(chunks[i], tags);
      allThoughts = allThoughts.concat(extractedThoughts);
    }

    // Deduplicate thoughts
    const uniqueThoughts = claudeService.deduplicateThoughts(allThoughts);
    console.log(`Extracted ${uniqueThoughts.length} unique thoughts`);

    // Map tag names to tag IDs
    const tagMap = new Map(tags.map(t => [t.name, t._id]));

    // Create thought records
    const thoughtDocs = [];
    for (const thought of uniqueThoughts) {
      const tagIds = thought.tags
        .map(name => tagMap.get(name))
        .filter(id => id);

      const thoughtDoc = new Thought({
        meetingMinutesId: meeting._id,
        content: thought.content,
        originalSegment: thought.originalSegment || '',
        tags: tagIds,
        confidence: thought.confidence || 0.8,
        isImportant: thought.isImportant || false
      });

      thoughtDocs.push(thoughtDoc);
    }

    // Batch get embeddings (if Voyage API is configured)
    const thoughtsWithEmbeddings = await similarityService.batchGetEmbeddings(thoughtDocs);

    // Save all thoughts
    await Thought.insertMany(thoughtsWithEmbeddings);

    // Update tag counts
    for (const thought of thoughtsWithEmbeddings) {
      await Tag.updateMany(
        { _id: { $in: thought.tags } },
        { $inc: { thoughtCount: 1 } }
      );
    }

    // Find similar thoughts
    const allExistingThoughts = await Thought.find({ isMerged: false });
    for (const thought of thoughtsWithEmbeddings) {
      if (thought._id) {
        const similarThoughts = await similarityService.findSimilarThoughts(
          thought,
          allExistingThoughts
        );
        if (similarThoughts.length > 0) {
          await Thought.findByIdAndUpdate(thought._id, {
            $set: { similarThoughts }
          });
        }
      }
    }

    // Update meeting status
    meeting.processStatus = 'completed';
    meeting.thoughtCount = thoughtsWithEmbeddings.length;
    meeting.processedAt = new Date();
    await meeting.save();

    console.log(`Meeting processing completed: ${meeting.title}`);
  } catch (error) {
    console.error('Processing failed:', error);
    meeting.processStatus = 'failed';
    meeting.processError = error.message;
    await meeting.save();
  }
}

// Delete meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await MeetingMinutes.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Delete associated thoughts
    const thoughts = await Thought.find({ meetingMinutesId: meeting._id });
    for (const thought of thoughts) {
      // Decrement tag counts
      await Tag.updateMany(
        { _id: { $in: thought.tags } },
        { $inc: { thoughtCount: -1 } }
      );
    }
    await Thought.deleteMany({ meetingMinutesId: meeting._id });

    // Delete meeting
    await MeetingMinutes.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
