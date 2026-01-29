const { Thought, Tag, MeetingMinutes } = require('../models');
const similarityService = require('../services/similarityService');

// Get all thoughts with filtering
exports.getThoughts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      tags,
      meetingId,
      isImportant,
      startDate,
      endDate,
      search
    } = req.query;

    const query = { isMerged: false };

    // Filter by tags
    if (tags) {
      const tagIds = tags.split(',');
      query.tags = { $in: tagIds };
    }

    // Filter by meeting
    if (meetingId) {
      query.meetingMinutesId = meetingId;
    }

    // Filter by importance
    if (isImportant === 'true') {
      query.isImportant = true;
    }

    // Filter by date range (based on meeting date)
    if (startDate || endDate) {
      const meetingQuery = {};
      if (startDate) meetingQuery.meetingDate = { $gte: new Date(startDate) };
      if (endDate) {
        meetingQuery.meetingDate = {
          ...meetingQuery.meetingDate,
          $lte: new Date(endDate)
        };
      }
      const meetings = await MeetingMinutes.find(meetingQuery).select('_id');
      query.meetingMinutesId = { $in: meetings.map(m => m._id) };
    }

    // Search in content
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const thoughts = await Thought.find(query)
      .populate('tags')
      .populate('meetingMinutesId', 'title meetingDate')
      .sort({ createdAt: -1, isImportant: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Thought.countDocuments(query);

    res.json({
      success: true,
      data: thoughts,
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

// Get thought by ID
exports.getThought = async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id)
      .populate('tags')
      .populate('meetingMinutesId', 'title meetingDate')
      .populate('similarThoughts.thoughtId', 'content tags');

    if (!thought) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found'
      });
    }

    res.json({
      success: true,
      data: thought
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update thought
exports.updateThought = async (req, res) => {
  try {
    const { content, tags, isImportant } = req.body;

    const thought = await Thought.findById(req.params.id);
    if (!thought) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found'
      });
    }

    // Update tag counts if tags changed
    if (tags && JSON.stringify(tags) !== JSON.stringify(thought.tags.map(t => t.toString()))) {
      // Decrement old tag counts
      await Tag.updateMany(
        { _id: { $in: thought.tags } },
        { $inc: { thoughtCount: -1 } }
      );
      // Increment new tag counts
      await Tag.updateMany(
        { _id: { $in: tags } },
        { $inc: { thoughtCount: 1 } }
      );
      thought.tags = tags;
    }

    if (content) thought.content = content;
    if (isImportant !== undefined) thought.isImportant = isImportant;

    await thought.save();

    // Re-populate for response
    await thought.populate('tags');
    await thought.populate('meetingMinutesId', 'title meetingDate');

    res.json({
      success: true,
      data: thought
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle important status
exports.toggleImportant = async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id);
    if (!thought) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found'
      });
    }

    thought.isImportant = !thought.isImportant;
    await thought.save();

    res.json({
      success: true,
      data: thought
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get thoughts with pending similar items
exports.getSimilarThoughts = async (req, res) => {
  try {
    const thoughts = await Thought.find({
      isMerged: false,
      'similarThoughts.status': 'pending'
    })
      .populate('tags')
      .populate('meetingMinutesId', 'title meetingDate')
      .populate('similarThoughts.thoughtId', 'content tags meetingMinutesId')
      .sort({ createdAt: -1 });

    // Filter to only include pending similar thoughts
    const result = thoughts.map(thought => ({
      ...thought.toObject(),
      similarThoughts: thought.similarThoughts.filter(st => st.status === 'pending')
    })).filter(thought => thought.similarThoughts.length > 0);

    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Merge similar thoughts
exports.mergeThoughts = async (req, res) => {
  try {
    const { primaryId, mergeIds, mergedContent } = req.body;

    if (!primaryId || !mergeIds || mergeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'primaryId and mergeIds are required'
      });
    }

    const primaryThought = await Thought.findById(primaryId);
    if (!primaryThought) {
      return res.status(404).json({
        success: false,
        message: 'Primary thought not found'
      });
    }

    // Get all thoughts to merge
    const thoughtsToMerge = await Thought.find({
      _id: { $in: mergeIds }
    });

    // Update primary thought
    if (mergedContent) {
      primaryThought.content = mergedContent;
    }

    // Collect all unique tags
    const allTags = new Set(primaryThought.tags.map(t => t.toString()));
    for (const thought of thoughtsToMerge) {
      thought.tags.forEach(t => allTags.add(t.toString()));
    }
    primaryThought.tags = Array.from(allTags);

    // Mark merged from
    primaryThought.mergedFrom = [
      ...primaryThought.mergedFrom,
      ...mergeIds
    ];

    // Update similar thoughts status
    primaryThought.similarThoughts = primaryThought.similarThoughts.map(st => {
      if (mergeIds.includes(st.thoughtId.toString())) {
        return { ...st, status: 'merged' };
      }
      return st;
    });

    await primaryThought.save();

    // Mark merged thoughts
    await Thought.updateMany(
      { _id: { $in: mergeIds } },
      { $set: { isMerged: true } }
    );

    // Update tag counts (decrease for merged thoughts)
    for (const thought of thoughtsToMerge) {
      await Tag.updateMany(
        { _id: { $in: thought.tags } },
        { $inc: { thoughtCount: -1 } }
      );
    }

    res.json({
      success: true,
      message: 'Thoughts merged successfully',
      data: primaryThought
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Dismiss similar thought
exports.dismissSimilar = async (req, res) => {
  try {
    const { thoughtId, similarThoughtId } = req.body;

    const thought = await Thought.findById(thoughtId);
    if (!thought) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found'
      });
    }

    thought.similarThoughts = thought.similarThoughts.map(st => {
      if (st.thoughtId.toString() === similarThoughtId) {
        return { ...st.toObject(), status: 'dismissed' };
      }
      return st;
    });

    await thought.save();

    res.json({
      success: true,
      message: 'Similar thought dismissed',
      data: thought
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete thought
exports.deleteThought = async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id);
    if (!thought) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found'
      });
    }

    // Decrement tag counts
    await Tag.updateMany(
      { _id: { $in: thought.tags } },
      { $inc: { thoughtCount: -1 } }
    );

    // Update meeting thought count
    await MeetingMinutes.findByIdAndUpdate(thought.meetingMinutesId, {
      $inc: { thoughtCount: -1 }
    });

    await Thought.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Thought deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
