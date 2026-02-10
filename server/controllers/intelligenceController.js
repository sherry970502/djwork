const IntelligenceKeyword = require('../models/intelligenceKeyword');
const IntelligenceReport = require('../models/intelligenceReport');
const intelligenceService = require('../services/intelligenceService');

// ==================== 关键词管理 ====================

// 获取所有关键词
exports.getKeywords = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const keywords = await IntelligenceKeyword.find(query)
      .sort({ priority: 1, createdAt: -1 });

    res.json({
      success: true,
      data: keywords
    });
  } catch (error) {
    console.error('Get keywords error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 创建关键词
exports.createKeyword = async (req, res) => {
  try {
    const { keyword, description, category, priority, searchQuery } = req.body;

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({
        success: false,
        message: '关键词不能为空'
      });
    }

    // 检查是否已存在
    const existing = await IntelligenceKeyword.findOne({ keyword: keyword.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '该关键词已存在'
      });
    }

    const newKeyword = new IntelligenceKeyword({
      keyword: keyword.trim(),
      description,
      category: category || '其他',
      priority: priority || 'medium',
      searchQuery: searchQuery || keyword.trim(),
      source: 'manual',
      createdBy: 'user'
    });

    await newKeyword.save();

    res.status(201).json({
      success: true,
      data: newKeyword
    });
  } catch (error) {
    console.error('Create keyword error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新关键词
exports.updateKeyword = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const keyword = await IntelligenceKeyword.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!keyword) {
      return res.status(404).json({
        success: false,
        message: '关键词不存在'
      });
    }

    res.json({
      success: true,
      data: keyword
    });
  } catch (error) {
    console.error('Update keyword error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除关键词
exports.deleteKeyword = async (req, res) => {
  try {
    const { id } = req.params;

    const keyword = await IntelligenceKeyword.findByIdAndDelete(id);
    if (!keyword) {
      return res.status(404).json({
        success: false,
        message: '关键词不存在'
      });
    }

    // 删除关联的情报
    await IntelligenceReport.deleteMany({ keyword: id });

    res.json({
      success: true,
      message: '关键词及相关情报已删除'
    });
  } catch (error) {
    console.error('Delete keyword error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== 情报管理 ====================

// 获取情报列表
exports.getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      keyword,
      isBookmarked,
      sortBy = 'hot',  // hot/latest/relevant
      search
    } = req.query;

    const query = {};

    if (keyword) {
      query.keyword = keyword;
    }

    if (isBookmarked !== undefined) {
      query.isBookmarked = isBookmarked === 'true';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }

    // 排序规则
    let sort = {};
    switch (sortBy) {
      case 'hot':
        sort = { hotScore: -1, freshnessScore: -1 };
        break;
      case 'latest':
        sort = { publishedAt: -1, fetchedAt: -1 };
        break;
      case 'relevant':
        sort = { relevanceScore: -1, hotScore: -1 };
        break;
      default:
        sort = { fetchedAt: -1 };
    }

    const reports = await IntelligenceReport.find(query)
      .populate('keyword', 'keyword category')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await IntelligenceReport.countDocuments(query);

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取单个情报详情
exports.getReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await IntelligenceReport.findById(id)
      .populate('keyword');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '情报不存在'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 切换收藏状态
exports.toggleBookmark = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await IntelligenceReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: '情报不存在'
      });
    }

    report.isBookmarked = !report.isBookmarked;
    report.bookmarkedAt = report.isBookmarked ? new Date() : null;
    await report.save();

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除情报
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await IntelligenceReport.findByIdAndDelete(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: '情报不存在'
      });
    }

    res.json({
      success: true,
      message: '情报已删除'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== 情报获取 ====================

// 手动获取情报（单个关键词）
exports.fetchIntelligence = async (req, res) => {
  try {
    const { keywordId } = req.params;
    const { timeRange, limit } = req.body;

    const result = await intelligenceService.fetchIntelligenceForKeyword(keywordId, {
      timeRange: timeRange || 'd',
      limit: limit || 10
    });

    res.json({
      success: true,
      data: result,
      message: `成功获取 ${result.newReports} 条新情报`
    });
  } catch (error) {
    console.error('Fetch intelligence error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 批量获取所有激活关键词的情报
exports.fetchAllIntelligence = async (req, res) => {
  try {
    const { timeRange, limit } = req.body;

    // 异步执行，不阻塞响应
    intelligenceService.fetchAllActiveKeywords({
      timeRange: timeRange || 'd',
      limit: limit || 10
    }).then(results => {
      console.log('[批量获取] 完成:', results.length, '个关键词');
    }).catch(error => {
      console.error('[批量获取] 失败:', error);
    });

    res.json({
      success: true,
      message: '已开始批量获取情报，请稍后刷新查看结果'
    });
  } catch (error) {
    console.error('Fetch all intelligence error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 分析情报
exports.analyzeReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await IntelligenceReport.findById(id).populate('keyword');
    if (!report) {
      return res.status(404).json({
        success: false,
        message: '情报不存在'
      });
    }

    // 如果已经分析过，返回现有分析
    if (report.aiAnalysis?.analyzedAt) {
      return res.json({
        success: true,
        data: report,
        message: '返回已有分析结果'
      });
    }

    const analysis = await intelligenceService.analyzeIntelligence(report, report.keyword);
    report.aiAnalysis = analysis;
    await report.save();

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Analyze report error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 批量分析情报
exports.batchAnalyze = async (req, res) => {
  try {
    const { reportIds } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要分析的情报ID列表'
      });
    }

    // 异步执行
    intelligenceService.batchAnalyzeReports(reportIds).then(count => {
      console.log(`[批量分析] 完成 ${count} 条`);
    }).catch(error => {
      console.error('[批量分析] 失败:', error);
    });

    res.json({
      success: true,
      message: `已开始分析 ${reportIds.length} 条情报，请稍后刷新查看结果`
    });
  } catch (error) {
    console.error('Batch analyze error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== 统计信息 ====================

exports.getStats = async (req, res) => {
  try {
    const [
      totalKeywords,
      activeKeywords,
      totalReports,
      bookmarkedReports,
      todayReports
    ] = await Promise.all([
      IntelligenceKeyword.countDocuments(),
      IntelligenceKeyword.countDocuments({ isActive: true }),
      IntelligenceReport.countDocuments(),
      IntelligenceReport.countDocuments({ isBookmarked: true }),
      IntelligenceReport.countDocuments({
        fetchedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalKeywords,
        activeKeywords,
        totalReports,
        bookmarkedReports,
        todayReports
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
