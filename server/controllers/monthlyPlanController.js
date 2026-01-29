const MonthlyPlan = require('../models/monthlyPlan');
const OrganizationTask = require('../models/organizationTask');
const MonthlyInsight = require('../models/monthlyInsight');
const MeetingMinutes = require('../models/meetingMinutes');
const Thought = require('../models/thought');
const reviewService = require('../services/reviewService');

// 获取月度计划
exports.getMonthlyPlan = async (req, res) => {
  try {
    const { month } = req.params;

    // 验证月份格式
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误，应为 YYYY-MM'
      });
    }

    let plan = await MonthlyPlan.findOne({ month });

    if (!plan) {
      // 如果不存在，创建一个空的计划
      plan = new MonthlyPlan({ month, items: [] });
      await plan.save();
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('获取月度计划失败:', error);
    res.status(500).json({
      success: false,
      message: '获取月度计划失败',
      error: error.message
    });
  }
};

// 同步数据到月度计划
exports.syncMonthlyPlan = async (req, res) => {
  try {
    const { month } = req.params;

    // 验证月份格式
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: '月份格式错误，应为 YYYY-MM'
      });
    }

    // 计算月份的开始和结束时间
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 1. 获取该月已完成分析的组织事务（从漏斗池确认下单的）
    const tasks = await OrganizationTask.find({
      status: 'completed',
      createdAt: { $gte: startDate, $lt: endDate }
    });

    // 2. 获取该月的 MonthlyInsight 中已接受的议题
    const insight = await MonthlyInsight.findOne({ month });
    const acceptedTopics = insight?.suggestedTopics?.filter(t => t.status === 'accepted') || [];

    // 获取或创建月度计划
    let plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      plan = new MonthlyPlan({ month, items: [] });
    }

    // 获取已存在的项目 ID
    const existingTaskIds = new Set(
      plan.items
        .filter(item => item.sourceType === 'task')
        .map(item => item.referenceId.toString())
    );
    const existingTopicIds = new Set(
      plan.items
        .filter(item => item.sourceType === 'topic')
        .map(item => item.referenceId.toString())
    );

    // 添加新的事务
    let addedCount = 0;
    for (const task of tasks) {
      if (!existingTaskIds.has(task._id.toString())) {
        plan.items.push({
          sourceType: 'task',
          referenceId: task._id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          planStatus: 'pending'
        });
        addedCount++;
      }
    }

    // 添加新的议题
    for (const topic of acceptedTopics) {
      if (!existingTopicIds.has(topic._id.toString())) {
        plan.items.push({
          sourceType: 'topic',
          referenceId: topic._id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          priority: topic.priority,
          planStatus: 'pending'
        });
        addedCount++;
      }
    }

    plan.lastSyncAt = new Date();
    plan.monthlySummary.totalItems = plan.items.length;
    await plan.save();

    res.json({
      success: true,
      data: plan,
      message: `同步完成，新增 ${addedCount} 个计划项目`
    });
  } catch (error) {
    console.error('同步月度计划失败:', error);
    res.status(500).json({
      success: false,
      message: '同步月度计划失败',
      error: error.message
    });
  }
};

// 更新计划项目状态
exports.updatePlanItem = async (req, res) => {
  try {
    const { month, itemId } = req.params;
    const { planStatus, notes } = req.body;

    const plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    const item = plan.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '计划项目不存在'
      });
    }

    if (planStatus) item.planStatus = planStatus;
    if (notes !== undefined) item.notes = notes;

    // 更新统计
    plan.monthlySummary.completedItems = plan.items.filter(i => i.planStatus === 'completed').length;
    plan.monthlySummary.partialItems = plan.items.filter(i => i.planStatus === 'in_progress').length;

    await plan.save();

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('更新计划项目失败:', error);
    res.status(500).json({
      success: false,
      message: '更新计划项目失败',
      error: error.message
    });
  }
};

// AI 复盘单个计划项目
exports.reviewPlanItem = async (req, res) => {
  try {
    const { month, itemId } = req.params;

    const plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    const item = plan.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '计划项目不存在'
      });
    }

    // 计算月份的开始和结束时间
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 1. 获取该月的会议纪要
    const meetings = await MeetingMinutes.find({
      processStatus: 'completed',
      meetingDate: { $gte: startDate, $lt: endDate }
    }).lean();

    // 为每个会议获取关联的思考
    for (const meeting of meetings) {
      const meetingThoughts = await Thought.find({ meetingMinutesId: meeting._id }).populate('tags').lean();
      meeting.thoughts = meetingThoughts;
    }

    // 2. 获取该月的灵感/思考
    const thoughts = await Thought.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tags').lean();

    // 3. 调用 AI 服务进行复盘
    const reviewResult = await reviewService.reviewPlanItem(item, meetings, thoughts);

    // 4. 保存复盘结果
    item.review = reviewResult;
    await plan.save();

    res.json({
      success: true,
      data: {
        item,
        review: reviewResult
      }
    });
  } catch (error) {
    console.error('AI 复盘失败:', error);
    res.status(500).json({
      success: false,
      message: 'AI 复盘失败',
      error: error.message
    });
  }
};

// AI 复盘整个月度计划
exports.reviewMonthlyPlan = async (req, res) => {
  try {
    const { month } = req.params;

    const plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    if (plan.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '月度计划中没有项目'
      });
    }

    // 计算月份的开始和结束时间
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 获取该月的会议纪要和灵感
    const meetings = await MeetingMinutes.find({
      processStatus: 'completed',
      meetingDate: { $gte: startDate, $lt: endDate }
    }).lean();

    // 为每个会议获取关联的思考
    for (const meeting of meetings) {
      const meetingThoughts = await Thought.find({ meetingMinutesId: meeting._id }).populate('tags').lean();
      meeting.thoughts = meetingThoughts;
    }

    const thoughts = await Thought.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tags').lean();

    // 对每个项目进行复盘
    let reviewedCount = 0;
    for (const item of plan.items) {
      try {
        const reviewResult = await reviewService.reviewPlanItem(item, meetings, thoughts);
        item.review = reviewResult;
        reviewedCount++;
      } catch (err) {
        console.error(`复盘项目 ${item.title} 失败:`, err);
      }
      // 避免 API 过载
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 生成月度总结
    const summary = await reviewService.generateMonthlySummary(plan, meetings, thoughts);
    plan.monthlySummary = {
      ...plan.monthlySummary,
      ...summary,
      generatedAt: new Date()
    };

    plan.lastReviewAt = new Date();
    await plan.save();

    res.json({
      success: true,
      data: plan,
      message: `复盘完成，共复盘 ${reviewedCount} 个项目`
    });
  } catch (error) {
    console.error('月度复盘失败:', error);
    res.status(500).json({
      success: false,
      message: '月度复盘失败',
      error: error.message
    });
  }
};

// 手动添加计划项目
exports.addPlanItem = async (req, res) => {
  try {
    const { month } = req.params;
    const { title, description, category, priority, sourceType, project } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: '标题不能为空'
      });
    }

    let plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      plan = new MonthlyPlan({ month, items: [] });
    }

    plan.items.push({
      sourceType: sourceType || 'manual',
      referenceId: new require('mongoose').Types.ObjectId(),  // 手动添加的生成新 ID
      title,
      description,
      project: project || 'other',  // 四大项目分类
      category: category || 'unknown',
      priority: priority || 'medium',
      planStatus: 'pending'
    });

    plan.monthlySummary.totalItems = plan.items.length;
    await plan.save();

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('添加计划项目失败:', error);
    res.status(500).json({
      success: false,
      message: '添加计划项目失败',
      error: error.message
    });
  }
};

// 删除计划项目
exports.removePlanItem = async (req, res) => {
  try {
    const { month, itemId } = req.params;

    const plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    plan.items.pull(itemId);
    plan.monthlySummary.totalItems = plan.items.length;
    plan.monthlySummary.completedItems = plan.items.filter(i => i.planStatus === 'completed').length;
    await plan.save();

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('删除计划项目失败:', error);
    res.status(500).json({
      success: false,
      message: '删除计划项目失败',
      error: error.message
    });
  }
};

// 获取所有月度计划列表
exports.getMonthlyPlanList = async (req, res) => {
  try {
    const plans = await MonthlyPlan.find()
      .select('month monthlySummary lastSyncAt lastReviewAt createdAt')
      .sort({ month: -1 });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('获取月度计划列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取月度计划列表失败',
      error: error.message
    });
  }
};

// 迁移计划项目到下一个月
exports.migrateItemToNextMonth = async (req, res) => {
  try {
    const { month, itemId } = req.params;
    const { upgradeToV2, evolutionNotes, newTitle, newDescription } = req.body;

    // 获取当前月份计划
    const currentPlan = await MonthlyPlan.findOne({ month });
    if (!currentPlan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    const item = currentPlan.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '计划项目不存在'
      });
    }

    // 计算下一个月
    const [year, monthNum] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, monthNum, 1); // monthNum 已经是下一个月了（0-indexed + 1）
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // 获取或创建下一个月的计划
    let nextPlan = await MonthlyPlan.findOne({ month: nextMonth });
    if (!nextPlan) {
      nextPlan = new MonthlyPlan({ month: nextMonth, items: [] });
    }

    // 准备继承的上下文
    let inheritedContext = '';
    if (item.review) {
      inheritedContext = `【${month}月复盘结论】\n`;
      inheritedContext += `完成状态: ${item.review.completionStatus}\n`;
      inheritedContext += `评价: ${item.review.summary || ''}\n`;
      if (item.review.meetingOutcomes?.length > 0) {
        inheritedContext += `相关会议: ${item.review.meetingOutcomes.map(m => m.meetingTitle).join(', ')}\n`;
      }
      if (item.review.gaps?.length > 0) {
        inheritedContext += `待补缺漏: ${item.review.gaps.map(g => g.dimension).join(', ')}\n`;
      }
    }

    // 计算版本号
    const currentVersion = item.migration?.version || 1;
    const newVersion = upgradeToV2 ? currentVersion + 1 : currentVersion;

    // 创建新的计划项目
    const newItem = {
      sourceType: 'migrated',
      referenceId: item.referenceId,
      title: newTitle || (upgradeToV2 ? `${item.title} v${newVersion}.0` : item.title),
      description: newDescription || item.description,
      project: item.project || 'other',
      category: item.category,
      priority: item.priority,
      planStatus: 'pending',
      notes: '',
      migration: {
        fromMonth: month,
        fromItemId: item._id,
        version: newVersion,
        inheritedContext: inheritedContext,
        evolutionNotes: evolutionNotes || (upgradeToV2 ? '从上月迁移并升级' : '从上月迁移继续')
      }
    };

    nextPlan.items.push(newItem);
    nextPlan.monthlySummary.totalItems = nextPlan.items.length;
    await nextPlan.save();

    // 更新当前项目状态为已迁移
    item.planStatus = 'migrated';
    item.notes = (item.notes || '') + `\n[已迁移至 ${nextMonth}]`;
    await currentPlan.save();

    res.json({
      success: true,
      data: {
        currentPlan,
        nextPlan,
        migratedItem: newItem
      },
      message: `已将项目迁移至 ${nextMonth}`
    });
  } catch (error) {
    console.error('迁移计划项目失败:', error);
    res.status(500).json({
      success: false,
      message: '迁移计划项目失败',
      error: error.message
    });
  }
};

// 批量迁移未完成项目
exports.batchMigrateItems = async (req, res) => {
  try {
    const { month } = req.params;
    const { itemIds, upgradeToV2 } = req.body;

    const currentPlan = await MonthlyPlan.findOne({ month });
    if (!currentPlan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    // 计算下一个月
    const [year, monthNum] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, monthNum, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    let nextPlan = await MonthlyPlan.findOne({ month: nextMonth });
    if (!nextPlan) {
      nextPlan = new MonthlyPlan({ month: nextMonth, items: [] });
    }

    let migratedCount = 0;
    for (const itemId of itemIds) {
      const item = currentPlan.items.id(itemId);
      if (!item || item.planStatus === 'completed' || item.planStatus === 'migrated') {
        continue;
      }

      // 准备继承的上下文
      let inheritedContext = '';
      if (item.review) {
        inheritedContext = `【${month}月复盘】完成状态: ${item.review.completionStatus}, 评价: ${item.review.summary || '无'}`;
      }

      const currentVersion = item.migration?.version || 1;
      const newVersion = upgradeToV2 ? currentVersion + 1 : currentVersion;

      nextPlan.items.push({
        sourceType: 'migrated',
        referenceId: item.referenceId,
        title: upgradeToV2 ? `${item.title} v${newVersion}.0` : item.title,
        description: item.description,
        project: item.project || 'other',
        category: item.category,
        priority: item.priority,
        planStatus: 'pending',
        migration: {
          fromMonth: month,
          fromItemId: item._id,
          version: newVersion,
          inheritedContext: inheritedContext,
          evolutionNotes: upgradeToV2 ? '批量迁移并升级' : '批量迁移'
        }
      });

      item.planStatus = 'migrated';
      migratedCount++;
    }

    nextPlan.monthlySummary.totalItems = nextPlan.items.length;
    await nextPlan.save();
    await currentPlan.save();

    res.json({
      success: true,
      data: { currentPlan, nextPlan },
      message: `已将 ${migratedCount} 个项目迁移至 ${nextMonth}`
    });
  } catch (error) {
    console.error('批量迁移失败:', error);
    res.status(500).json({
      success: false,
      message: '批量迁移失败',
      error: error.message
    });
  }
};

// 更新计划项目的项目分类
exports.updateItemProject = async (req, res) => {
  try {
    const { month, itemId } = req.params;
    const { project } = req.body;

    const plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: '月度计划不存在'
      });
    }

    const item = plan.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '计划项目不存在'
      });
    }

    item.project = project;
    await plan.save();

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('更新项目分类失败:', error);
    res.status(500).json({
      success: false,
      message: '更新项目分类失败',
      error: error.message
    });
  }
};
