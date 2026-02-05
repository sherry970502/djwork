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
    console.log('Generate monthly insight request:', req.body);
    const { month } = req.body;

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!month || !monthRegex.test(month)) {
      console.error('Invalid month format:', month);
      return res.status(400).json({
        success: false,
        message: 'Month must be in YYYY-MM format'
      });
    }

    // Check if insight already exists
    let insight = await MonthlyInsight.findOne({ month });

    // Get date range for the month (使用 UTC 避免时区问题)
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    console.log(`月度洞察数据查询范围: ${startDate.toISOString()} - ${endDate.toISOString()}`);

    // 智能筛选策略：优先获取重要的、有标签的灵感
    // 第一优先级：标记为重要的
    const importantThoughts = await Thought.find({
      isMerged: false,
      isImportant: true,
      createdAt: { $gte: startDate, $lt: endDate }
    })
    .populate('tags')
    .sort({ createdAt: -1 })
    .limit(100);

    // 第二优先级：有标签的（排除已获取的重要灵感）
    const importantIds = importantThoughts.map(t => t._id);
    const taggedThoughts = await Thought.find({
      isMerged: false,
      isImportant: { $ne: true },
      tags: { $exists: true, $ne: [] },
      _id: { $nin: importantIds },
      createdAt: { $gte: startDate, $lt: endDate }
    })
    .populate('tags')
    .sort({ createdAt: -1 })
    .limit(150);

    // 第三优先级：其他灵感（补充到 300 条）
    const existingIds = [...importantIds, ...taggedThoughts.map(t => t._id)];
    const remainingLimit = 300 - importantThoughts.length - taggedThoughts.length;

    let otherThoughts = [];
    if (remainingLimit > 0) {
      otherThoughts = await Thought.find({
        isMerged: false,
        _id: { $nin: existingIds },
        createdAt: { $gte: startDate, $lt: endDate }
      })
      .populate('tags')
      .sort({ createdAt: -1 })
      .limit(remainingLimit);
    }

    // 合并所有灵感
    const recentThoughts = [...importantThoughts, ...taggedThoughts, ...otherThoughts];

    console.log(`本月灵感筛选结果: 重要 ${importantThoughts.length} 条, 有标签 ${taggedThoughts.length} 条, 其他 ${otherThoughts.length} 条, 共 ${recentThoughts.length} 条`);

    // Get pending tasks (获取该月创建或更新的任务)
    const pendingTasks = await OrganizationTask.find({
      $or: [
        { status: { $in: ['pending', 'analyzing'] } },  // 待处理的任务
        {
          status: 'completed',
          createdAt: { $gte: startDate, $lt: endDate }  // 本月完成的任务
        }
      ]
    })
    .sort({ priority: 1, createdAt: -1 })
    .limit(30);  // 从 20 提高到 30

    console.log(`找到 ${pendingTasks.length} 条相关任务`);

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
    console.error('Generate monthly insight error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
