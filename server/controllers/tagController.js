const { Tag, Thought } = require('../models');
const config = require('../config');

// Get all tags
exports.getTags = async (req, res) => {
  try {
    const tags = await Tag.find().sort({ thoughtCount: -1, displayName: 1 });
    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get tag by ID
exports.getTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    res.json({
      success: true,
      data: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create tag
exports.createTag = async (req, res) => {
  try {
    const { name, displayName, description, color, keywords } = req.body;

    // Check if tag name already exists
    const existing = await Tag.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Tag name already exists'
      });
    }

    const tag = new Tag({
      name,
      displayName,
      description: description || '',
      color: color || '#1890ff',
      keywords: keywords || [],
      isPreset: false
    });

    await tag.save();
    res.status(201).json({
      success: true,
      data: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update tag
exports.updateTag = async (req, res) => {
  try {
    const { displayName, description, color, keywords } = req.body;

    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    // Update fields
    if (displayName) tag.displayName = displayName;
    if (description !== undefined) tag.description = description;
    if (color) tag.color = color;
    if (keywords) tag.keywords = keywords;

    await tag.save();
    res.json({
      success: true,
      data: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete tag (only non-preset tags)
exports.deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    if (tag.isPreset) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete preset tags'
      });
    }

    // Remove tag from all thoughts
    await Thought.updateMany(
      { tags: tag._id },
      { $pull: { tags: tag._id } }
    );

    await Tag.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get tag statistics
exports.getTagStats = async (req, res) => {
  try {
    const stats = await Tag.aggregate([
      {
        $lookup: {
          from: 'thoughts',
          localField: '_id',
          foreignField: 'tags',
          as: 'thoughts'
        }
      },
      {
        $project: {
          name: 1,
          displayName: 1,
          color: 1,
          thoughtCount: { $size: '$thoughts' },
          importantCount: {
            $size: {
              $filter: {
                input: '$thoughts',
                as: 'thought',
                cond: { $eq: ['$$thought.isImportant', true] }
              }
            }
          }
        }
      },
      { $sort: { thoughtCount: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Find matching content for tag (meetings and thoughts)
exports.findMatchingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { useAI } = req.query; // 是否使用AI智能推荐

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    console.log(`[标签匹配] 开始为标签"${tag.displayName}"查找匹配内容`);
    console.log(`[标签匹配] 关键词: ${tag.keywords.join(', ')}`);

    const MeetingMinutes = require('../models/meetingMinutes');

    // 1. 基于关键词的快速匹配
    let matchedMeetings = [];
    let matchedThoughts = [];

    if (tag.keywords && tag.keywords.length > 0) {
      // 查找所有已完成的会议
      const allMeetings = await MeetingMinutes.find({
        processStatus: 'completed'
      }).select('title content meetingDate').lean();

      // 查找所有未合并的灵感
      const allThoughts = await Thought.find({
        isMerged: false
      })
      .populate('tags', 'displayName')
      .populate('meetingMinutesId', 'title meetingDate')
      .lean();

      // 为每个会议计算匹配分数
      matchedMeetings = allMeetings.map(meeting => {
        let score = 0;
        const matchedKeywords = [];

        for (const keyword of tag.keywords) {
          const keywordLower = keyword.toLowerCase();
          // 标题匹配
          if (meeting.title && meeting.title.toLowerCase().includes(keywordLower)) {
            score += 20;
            matchedKeywords.push({ keyword, source: '标题' });
          }
          // 内容匹配
          if (meeting.content && meeting.content.toLowerCase().includes(keywordLower)) {
            // 计算出现次数
            const regex = new RegExp(keywordLower, 'gi');
            const matches = meeting.content.match(regex);
            const count = matches ? matches.length : 0;
            score += count * 5;
            if (!matchedKeywords.find(m => m.keyword === keyword)) {
              matchedKeywords.push({ keyword, source: `内容(${count}次)` });
            }
          }
        }

        return {
          _id: meeting._id,
          type: 'meeting',
          title: meeting.title,
          meetingDate: meeting.meetingDate,
          score,
          matchedKeywords,
          matchPercentage: Math.min(100, Math.round((score / (tag.keywords.length * 20)) * 100))
        };
      }).filter(m => m.score > 0);

      // 为每个灵感计算匹配分数
      matchedThoughts = allThoughts.map(thought => {
        let score = 0;
        const matchedKeywords = [];

        for (const keyword of tag.keywords) {
          const keywordLower = keyword.toLowerCase();

          // 内容匹配
          if (thought.content && thought.content.toLowerCase().includes(keywordLower)) {
            const regex = new RegExp(keywordLower, 'gi');
            const matches = thought.content.match(regex);
            const count = matches ? matches.length : 0;
            score += count * 10;
            matchedKeywords.push({ keyword, source: `内容(${count}次)` });
          }

          // 已有标签匹配
          const existingTags = thought.tags.map(t => t.displayName).join(' ');
          if (existingTags.toLowerCase().includes(keywordLower)) {
            score += 15;
            if (!matchedKeywords.find(m => m.keyword === keyword)) {
              matchedKeywords.push({ keyword, source: '已有标签' });
            }
          }
        }

        return {
          _id: thought._id,
          type: 'thought',
          content: thought.content,
          meetingTitle: thought.meetingMinutesId?.title,
          meetingDate: thought.meetingMinutesId?.meetingDate,
          existingTags: thought.tags.map(t => t.displayName),
          score,
          matchedKeywords,
          matchPercentage: Math.min(100, Math.round((score / (tag.keywords.length * 15)) * 100))
        };
      }).filter(t => t.score > 0 && !t.existingTags.includes(tag.displayName));

      // 排序
      matchedMeetings.sort((a, b) => b.score - a.score);
      matchedThoughts.sort((a, b) => b.score - a.score);

      console.log(`[标签匹配] 关键词匹配到 ${matchedMeetings.length} 个会议, ${matchedThoughts.length} 条灵感`);
    }

    res.json({
      success: true,
      data: {
        tag: {
          _id: tag._id,
          displayName: tag.displayName,
          keywords: tag.keywords,
          description: tag.description
        },
        matchedMeetings,
        matchedThoughts,
        summary: {
          totalMeetings: matchedMeetings.length,
          totalThoughts: matchedThoughts.length,
          highScoreMeetings: matchedMeetings.filter(m => m.matchPercentage >= 80).length,
          highScoreThoughts: matchedThoughts.filter(t => t.matchPercentage >= 80).length
        }
      }
    });
  } catch (error) {
    console.error('查找匹配内容失败:', error);
    res.status(500).json({
      success: false,
      message: `查找失败: ${error.message}`
    });
  }
};

// Apply tag to selected meetings and thoughts
exports.applyTagToHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { meetingIds, thoughtIds, applyToMeetingThoughts } = req.body;

    const tag = await Tag.findById(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    let updatedThoughtCount = 0;
    let updatedMeetingCount = 0;

    // 应用标签到选中的灵感
    if (thoughtIds && thoughtIds.length > 0) {
      const result = await Thought.updateMany(
        {
          _id: { $in: thoughtIds },
          tags: { $ne: tag._id } // 避免重复添加
        },
        { $addToSet: { tags: tag._id } }
      );
      updatedThoughtCount = result.modifiedCount;
      console.log(`[应用标签] 为 ${updatedThoughtCount} 条灵感添加标签"${tag.displayName}"`);
    }

    // 如果选择了会议，且要应用到会议下的所有灵感
    if (meetingIds && meetingIds.length > 0) {
      updatedMeetingCount = meetingIds.length;

      if (applyToMeetingThoughts) {
        // 查找这些会议下的所有灵感
        const meetingThoughts = await Thought.find({
          meetingMinutesId: { $in: meetingIds },
          tags: { $ne: tag._id }
        });

        if (meetingThoughts.length > 0) {
          const thoughtIdsToUpdate = meetingThoughts.map(t => t._id);
          const result = await Thought.updateMany(
            { _id: { $in: thoughtIdsToUpdate } },
            { $addToSet: { tags: tag._id } }
          );
          updatedThoughtCount += result.modifiedCount;
          console.log(`[应用标签] 为 ${meetingIds.length} 个会议下的 ${result.modifiedCount} 条灵感添加标签"${tag.displayName}"`);
        }
      }
    }

    // 更新标签的使用计数
    const totalTaggedThoughts = await Thought.countDocuments({ tags: tag._id });
    tag.thoughtCount = totalTaggedThoughts;
    await tag.save();

    res.json({
      success: true,
      data: {
        updatedThoughtCount,
        updatedMeetingCount,
        totalTaggedThoughts: tag.thoughtCount
      },
      message: `成功应用！已为 ${updatedThoughtCount} 条灵感添加标签`
    });
  } catch (error) {
    console.error('应用标签失败:', error);
    res.status(500).json({
      success: false,
      message: `应用失败: ${error.message}`
    });
  }
};

// Initialize preset tags
exports.initPresetTags = async () => {
  try {
    for (const preset of config.presetTags) {
      const existing = await Tag.findOne({ name: preset.name });
      if (!existing) {
        await Tag.create({
          ...preset,
          isPreset: true,
          thoughtCount: 0
        });
        console.log(`Created preset tag: ${preset.displayName}`);
      }
    }
  } catch (error) {
    console.error('Failed to initialize preset tags:', error);
  }
};
