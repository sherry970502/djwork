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

// Reprocess meeting with improved extraction (V2)
exports.reprocessMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { preserveManual, preserveMerged } = req.body;

    const meeting = await MeetingMinutes.findById(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: '会议不存在'
      });
    }

    if (meeting.processStatus === 'processing') {
      return res.status(400).json({
        success: false,
        message: '会议正在处理中，请稍后再试'
      });
    }

    console.log(`[重新整理] 开始重新整理会议: ${meeting.title}`);
    console.log(`[重新整理] 选项 - 保留手动添加: ${preserveManual}, 保留已合并: ${preserveMerged}`);

    // 查找现有的灵感
    const existingThoughts = await Thought.find({ meetingMinutesId: meeting._id });

    const thoughtsToDelete = existingThoughts.filter(t => {
      // 如果是手动添加的(extractionVersion不存在或为1)且要保留，则不删除
      if (preserveManual && (!t.extractionVersion || t.extractionVersion === 1)) {
        // 这里可以添加更多判断逻辑来识别手动添加的
        return false;
      }
      // 如果已合并且要保留，则不删除
      if (preserveMerged && t.isMerged) {
        return false;
      }
      return true;
    });

    console.log(`[重新整理] 将删除 ${thoughtsToDelete.length} 条旧灵感，保留 ${existingThoughts.length - thoughtsToDelete.length} 条`);

    // 删除旧灵感
    if (thoughtsToDelete.length > 0) {
      const thoughtIdsToDelete = thoughtsToDelete.map(t => t._id);

      // 更新标签计数
      for (const thought of thoughtsToDelete) {
        if (thought.tags && thought.tags.length > 0) {
          await Tag.updateMany(
            { _id: { $in: thought.tags } },
            { $inc: { thoughtCount: -1 } }
          );
        }
      }

      await Thought.deleteMany({ _id: { $in: thoughtIdsToDelete } });
    }

    // 重置会议状态并开始处理
    meeting.processStatus = 'processing';
    meeting.processStartTime = new Date();
    await meeting.save();

    // 异步处理
    reprocessAsync(meeting._id).catch(error => {
      console.error(`[重新整理] 异步处理失败: ${error.message}`);
    });

    res.json({
      success: true,
      message: '已开始重新整理，请稍后查看结果',
      data: {
        deletedCount: thoughtsToDelete.length,
        preservedCount: existingThoughts.length - thoughtsToDelete.length
      }
    });

  } catch (error) {
    console.error('[重新整理] 失败:', error);
    res.status(500).json({
      success: false,
      message: `重新整理失败: ${error.message}`
    });
  }
};

// Async reprocessing with V2 extraction
async function reprocessAsync(meetingId) {
  try {
    const meeting = await MeetingMinutes.findById(meetingId);
    if (!meeting) return;

    console.log(`[重新整理-异步] 开始处理: ${meeting.title}`);

    // Get all tags
    const tags = await Tag.find();

    // Split content into chunks (similar to original processing)
    const maxChunkSize = 8000;
    const content = meeting.content || '';
    const chunks = [];

    if (content.length <= maxChunkSize) {
      chunks.push(content);
    } else {
      const sentences = content.split(/[。！？；\n]/);
      let currentChunk = '';

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          currentChunk += sentence + '。';
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
    }

    console.log(`[重新整理-异步] 内容分为 ${chunks.length} 个片段`);

    // Extract thoughts from each chunk using V2
    const allExtractedThoughts = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[重新整理-异步] 处理片段 ${i + 1}/${chunks.length}...`);
      try {
        const extractedThoughts = await claudeService.extractThoughtsV2(chunks[i], tags);
        console.log(`[重新整理-异步] 片段 ${i + 1} 提取了 ${extractedThoughts.length} 条灵感`);
        allExtractedThoughts.push(...extractedThoughts);
      } catch (error) {
        console.error(`[重新整理-异步] 片段 ${i + 1} 提取失败:`, error.message);
      }
    }

    // Deduplicate
    const dedupedThoughts = claudeService.deduplicateThoughts(allExtractedThoughts);
    console.log(`[重新整理-异步] 去重后: ${dedupedThoughts.length} 条灵感`);

    // Save thoughts to database
    const savedThoughts = [];
    for (const thoughtData of dedupedThoughts) {
      try {
        // Map tag names to tag IDs
        const tagIds = [];
        if (thoughtData.tags && thoughtData.tags.length > 0) {
          for (const tagName of thoughtData.tags) {
            const tag = tags.find(t => t.name === tagName);
            if (tag) {
              tagIds.push(tag._id);
              // Increment tag count
              await Tag.findByIdAndUpdate(tag._id, { $inc: { thoughtCount: 1 } });
            }
          }
        }

        const thought = new Thought({
          meetingMinutesId: meeting._id,
          content: thoughtData.content,
          contentType: thoughtData.contentType || 'IDEA',
          speaker: thoughtData.speaker || 'DJ',
          originalQuote: thoughtData.originalQuote || '',
          context: thoughtData.context || '',
          originalSegment: thoughtData.originalSegment || thoughtData.originalQuote || '',
          tags: tagIds,
          confidence: thoughtData.confidence || 0.8,
          extractionVersion: 2,
          isImportant: thoughtData.isImportant || false
        });

        await thought.save();
        savedThoughts.push(thought);
      } catch (error) {
        console.error('[重新整理-异步] 保存灵感失败:', error.message);
      }
    }

    // Update meeting status
    meeting.processStatus = 'completed';
    meeting.processEndTime = new Date();
    meeting.thoughtCount = savedThoughts.length;
    await meeting.save();

    console.log(`[重新整理-异步] 完成: ${meeting.title}, 共 ${savedThoughts.length} 条灵感`);

  } catch (error) {
    console.error('[重新整理-异步] 处理失败:', error);
    // Update meeting status to failed
    try {
      await MeetingMinutes.findByIdAndUpdate(meetingId, {
        processStatus: 'failed',
        processEndTime: new Date()
      });
    } catch (updateError) {
      console.error('[重新整理-异步] 更新状态失败:', updateError);
    }
  }
}
