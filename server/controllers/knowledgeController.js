const { KnowledgeQA, Thought, OrganizationTask, MonthlyInsight } = require('../models');
const strategicAdvisorService = require('../services/strategicAdvisorService');

// Ask knowledge base
exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    // Get answer from strategic advisor
    const result = await strategicAdvisorService.askKnowledgeBase(question);

    // Save QA record
    const qa = new KnowledgeQA({
      question: question.trim(),
      answer: result.answer,
      relatedThoughts: result.relatedThoughts,
      confidence: result.confidence
    });

    await qa.save();

    // Populate related thoughts for response
    await qa.populate('relatedThoughts');

    res.json({
      success: true,
      data: qa
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get QA history
exports.getQAHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const qas = await KnowledgeQA.find()
      .populate('relatedThoughts')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await KnowledgeQA.countDocuments();

    res.json({
      success: true,
      data: qas,
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

// Rate QA helpful
exports.rateQA = async (req, res) => {
  try {
    const { helpful } = req.body;

    const qa = await KnowledgeQA.findById(req.params.id);
    if (!qa) {
      return res.status(404).json({
        success: false,
        message: 'QA record not found'
      });
    }

    qa.helpful = helpful;
    await qa.save();

    res.json({
      success: true,
      data: qa
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Generate monthly insight
exports.generateMonthlyInsight = async (req, res) => {
  try {
    const { month } = req.body;

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Month must be in YYYY-MM format'
      });
    }

    // Check if insight already exists
    let insight = await MonthlyInsight.findOne({ month });

    // Get recent thoughts for the month
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const recentThoughts = await Thought.find({
      isMerged: false,
      createdAt: { $gte: startDate, $lt: endDate }
    })
    .populate('tags')
    .sort({ isImportant: -1, createdAt: -1 })
    .limit(50);

    // Get pending tasks
    const pendingTasks = await OrganizationTask.find({
      status: { $in: ['pending', 'completed'] }
    })
    .sort({ priority: 1, createdAt: -1 })
    .limit(20);

    // Generate insight
    const insightResult = await strategicAdvisorService.generateMonthlyInsight(
      month,
      recentThoughts,
      pendingTasks
    );

    if (insight) {
      // Update existing
      insight.recentThoughts = recentThoughts.map(t => t._id);
      insight.pendingTasks = pendingTasks.map(t => t._id);
      insight.thoughtsSummary = insightResult.thoughtsSummary;
      insight.tasksSummary = insightResult.tasksSummary;
      insight.suggestedTopics = insightResult.suggestedTopics;
      insight.generatedAt = new Date();
    } else {
      // Create new
      insight = new MonthlyInsight({
        month,
        recentThoughts: recentThoughts.map(t => t._id),
        pendingTasks: pendingTasks.map(t => t._id),
        thoughtsSummary: insightResult.thoughtsSummary,
        tasksSummary: insightResult.tasksSummary,
        suggestedTopics: insightResult.suggestedTopics
      });
    }

    await insight.save();

    // Populate for response
    await insight.populate('recentThoughts');
    await insight.populate('pendingTasks');

    res.json({
      success: true,
      data: insight
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get monthly insight
exports.getMonthlyInsight = async (req, res) => {
  try {
    const { month } = req.params;

    const insight = await MonthlyInsight.findOne({ month })
      .populate('recentThoughts')
      .populate('pendingTasks');

    if (!insight) {
      return res.status(404).json({
        success: false,
        message: 'Insight not found for this month'
      });
    }

    res.json({
      success: true,
      data: insight
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all monthly insights
exports.getMonthlyInsights = async (req, res) => {
  try {
    const insights = await MonthlyInsight.find()
      .sort({ month: -1 })
      .limit(12);

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update suggested topic status
exports.updateTopicStatus = async (req, res) => {
  try {
    const { month, topicId } = req.params;
    const { status } = req.body;

    if (!['suggested', 'accepted', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const insight = await MonthlyInsight.findOne({ month });
    if (!insight) {
      return res.status(404).json({
        success: false,
        message: 'Insight not found'
      });
    }

    const topic = insight.suggestedTopics.id(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    topic.status = status;
    await insight.save();

    res.json({
      success: true,
      data: insight
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
