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

    // 手动 populate referenceId，因为不同的 sourceType 指向不同的 collection
    const planObj = plan.toObject();

    for (let i = 0; i < planObj.items.length; i++) {
      const item = planObj.items[i];

      if (item.sourceType === 'task') {
        // 从组织事务池获取完整数据（包括 AI 分析）
        const task = await OrganizationTask.findById(item.referenceId);
        if (task) {
          planObj.items[i].taskDetail = task;
        }
      } else if (item.sourceType === 'topic') {
        // 从月度洞察获取议题详情
        // topic 的 referenceId 是议题的 _id，需要从洞察中查找
        const insight = await MonthlyInsight.findOne({
          'suggestedTopics._id': item.referenceId
        });
        if (insight) {
          const topic = insight.suggestedTopics.id(item.referenceId);
          if (topic) {
            planObj.items[i].topicDetail = topic;
          }
        }
      }
    }

    res.json({
      success: true,
      data: planObj
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

    // 2. 获取上个月的 MonthlyInsight 中已接受的议题
    // 逻辑：N月的洞察（N月底生成）→ 指导N+1月的工作
    // 例如：2026-01的洞察 → 同步到2026-02的计划
    const [year, monthNum] = month.split('-').map(Number);
    const prevMonthDate = new Date(year, monthNum - 2, 1); // monthNum-2 因为月份从0开始
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const insight = await MonthlyInsight.findOne({ month: prevMonth });
    console.log('🔍 [同步调试] 查找月度洞察:', {
      当前月份: month,
      查找洞察月份: prevMonth,
      insightFound: !!insight
    });

    if (insight) {
      console.log('📊 [同步调试] 议题统计:', {
        总议题数: insight.suggestedTopics?.length || 0,
        议题状态分布: insight.suggestedTopics?.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {})
      });
    }

    const acceptedTopics = insight?.suggestedTopics?.filter(t => t.status === 'accepted') || [];
    console.log('✅ [同步调试] 已接受议题:', {
      数量: acceptedTopics.length,
      议题列表: acceptedTopics.map(t => ({
        _id: t._id?.toString(),
        title: t.title,
        status: t.status
      }))
    });

    // 获取或创建月度计划
    let plan = await MonthlyPlan.findOne({ month });
    if (!plan) {
      plan = new MonthlyPlan({ month, items: [] });
      console.log('🆕 [同步调试] 创建新的月度计划');
    } else {
      console.log('📋 [同步调试] 找到已有月度计划:', {
        现有项目数: plan.items.length,
        项目类型分布: plan.items.reduce((acc, item) => {
          acc[item.sourceType] = (acc[item.sourceType] || 0) + 1;
          return acc;
        }, {})
      });
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

    console.log('🔑 [同步调试] 已存在ID:', {
      任务数: existingTaskIds.size,
      议题数: existingTopicIds.size,
      议题IDs: Array.from(existingTopicIds)
    });

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
    let topicAddedCount = 0;
    for (const topic of acceptedTopics) {
      const topicIdStr = topic._id.toString();
      console.log('🎯 [同步调试] 处理议题:', {
        _id: topicIdStr,
        title: topic.title,
        已存在: existingTopicIds.has(topicIdStr)
      });

      if (!existingTopicIds.has(topicIdStr)) {
        plan.items.push({
          sourceType: 'topic',
          referenceId: topic._id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          priority: topic.priority,
          planStatus: 'pending'
        });
        topicAddedCount++;
        addedCount++;
        console.log('➕ [同步调试] 新增议题到计划');
      } else {
        console.log('⏭️  [同步调试] 跳过已存在的议题');
      }
    }

    console.log('📈 [同步调试] 同步结果:', {
      新增任务: addedCount - topicAddedCount,
      新增议题: topicAddedCount,
      总新增: addedCount,
      最终项目数: plan.items.length
    });

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

    if (planStatus) {
      item.planStatus = planStatus;

      // 同步更新原始任务的执行状态
      if (item.sourceType === 'task' && item.referenceId) {
        try {
          await OrganizationTask.findByIdAndUpdate(
            item.referenceId,
            { executionStatus: planStatus },
            { new: true }
          );
        } catch (error) {
          console.error('同步任务执行状态失败:', error);
          // 不中断主流程，只记录错误
        }
      }
    }
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

// 获取计划项目的相关会议（智能检索）
exports.getRelatedMeetingsForItem = async (req, res) => {
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
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    // 提取关键词
    const keywords = extractKeywords(`${item.title} ${item.description || ''}`);
    console.log(`[复盘检索] 计划项目: ${item.title}`);
    console.log(`[复盘检索] 提取关键词: ${keywords.join(', ')}`);

    // 获取该月所有会议
    const allMeetings = await MeetingMinutes.find({
      processStatus: 'completed',
      meetingDate: { $gte: startDate, $lt: endDate }
    }).lean();

    // 为每个会议获取关联的思考
    for (const meeting of allMeetings) {
      const meetingThoughts = await Thought.find({ meetingMinutesId: meeting._id }).populate('tags').lean();
      meeting.thoughts = meetingThoughts;
    }

    // 对每个会议计算相关性得分
    const scoredMeetings = allMeetings.map(meeting => {
      let score = 0;
      const matchedKeywords = [];

      // 检查会议标题
      for (const keyword of keywords) {
        if (meeting.title && meeting.title.toLowerCase().includes(keyword.toLowerCase())) {
          score += 10;
          matchedKeywords.push({ keyword, source: '会议标题' });
        }
      }

      // 检查会议内容
      for (const keyword of keywords) {
        if (meeting.content && meeting.content.toLowerCase().includes(keyword.toLowerCase())) {
          score += 5;
          if (!matchedKeywords.find(m => m.keyword === keyword)) {
            matchedKeywords.push({ keyword, source: '会议内容' });
          }
        }
      }

      // 检查灵感标签和内容
      for (const thought of meeting.thoughts || []) {
        const tagNames = thought.tags?.map(t => t.displayName || t.name) || [];

        for (const keyword of keywords) {
          // 标签匹配
          if (tagNames.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))) {
            score += 8;
            if (!matchedKeywords.find(m => m.keyword === keyword)) {
              matchedKeywords.push({ keyword, source: '灵感标签' });
            }
          }
          // 灵感内容匹配
          if (thought.content && thought.content.toLowerCase().includes(keyword.toLowerCase())) {
            score += 3;
            if (!matchedKeywords.find(m => m.keyword === keyword)) {
              matchedKeywords.push({ keyword, source: '灵感内容' });
            }
          }
        }
      }

      return {
        _id: meeting._id,
        title: meeting.title,
        meetingDate: meeting.meetingDate,
        thoughtCount: meeting.thoughts?.length || 0,
        score,
        matchedKeywords,
        isRecommended: score > 0
      };
    });

    // 排序：有匹配的在前，按得分降序
    scoredMeetings.sort((a, b) => b.score - a.score);

    // 同时获取相关灵感
    const thoughts = await Thought.find({
      isMerged: false,
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tags').lean();

    const scoredThoughts = thoughts.map(thought => {
      let score = 0;
      const matchedKeywords = [];
      const tagNames = thought.tags?.map(t => t.displayName || t.name) || [];

      for (const keyword of keywords) {
        // 标签匹配
        if (tagNames.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))) {
          score += 10;
          matchedKeywords.push({ keyword, source: '标签' });
        }
        // 内容匹配
        if (thought.content && thought.content.toLowerCase().includes(keyword.toLowerCase())) {
          score += 5;
          if (!matchedKeywords.find(m => m.keyword === keyword)) {
            matchedKeywords.push({ keyword, source: '内容' });
          }
        }
      }

      return {
        _id: thought._id,
        content: thought.content,
        tags: tagNames,
        isImportant: thought.isImportant,
        createdAt: thought.createdAt,
        score,
        matchedKeywords,
        isRecommended: score > 0
      };
    }).filter(t => t.score > 0).sort((a, b) => b.score - a.score).slice(0, 20);

    res.json({
      success: true,
      data: {
        keywords,
        meetings: scoredMeetings,
        thoughts: scoredThoughts,
        recommendedMeetingIds: scoredMeetings.filter(m => m.isRecommended).map(m => m._id)
      }
    });
  } catch (error) {
    console.error('获取相关会议失败:', error);
    res.status(500).json({
      success: false,
      message: '获取相关会议失败',
      error: error.message
    });
  }
};

// 使用选中的会议进行复盘
exports.reviewPlanItemWithSelection = async (req, res) => {
  try {
    const { month, itemId } = req.params;
    const { selectedMeetingIds } = req.body;

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
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    // 获取用户选中的会议（包含完整内容）
    let meetings = [];
    if (selectedMeetingIds && selectedMeetingIds.length > 0) {
      meetings = await MeetingMinutes.find({
        _id: { $in: selectedMeetingIds }
      }).lean();

      // 为每个会议获取关联的思考
      for (const meeting of meetings) {
        const meetingThoughts = await Thought.find({ meetingMinutesId: meeting._id }).populate('tags').lean();
        meeting.thoughts = meetingThoughts;
      }

      console.log(`[复盘] 用户选择了 ${meetings.length} 个会议进行复盘`);
    } else {
      console.log(`[复盘] 用户未选择会议，将使用智能检索`);

      // 如果用户没有选择，使用智能检索
      const allMeetings = await MeetingMinutes.find({
        processStatus: 'completed',
        meetingDate: { $gte: startDate, $lt: endDate }
      }).lean();

      for (const meeting of allMeetings) {
        const meetingThoughts = await Thought.find({ meetingMinutesId: meeting._id }).populate('tags').lean();
        meeting.thoughts = meetingThoughts;
      }

      meetings = allMeetings;
    }

    // 获取该月的灵感/思考
    const thoughts = await Thought.find({
      isMerged: false,
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tags').lean();

    // 调用 AI 服务进行复盘（使用改进版）
    const reviewResult = await reviewService.reviewPlanItemWithContext(
      item,
      meetings,
      thoughts,
      selectedMeetingIds && selectedMeetingIds.length > 0
    );

    // 保存复盘结果
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
    console.error('复盘失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: `复盘失败: ${error.message}`,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 提取关键词的辅助函数
function extractKeywords(text) {
  const keywords = [];

  // 提取英文单词（至少2个字符）
  const englishWords = text.match(/[a-zA-Z]{2,}/g) || [];
  keywords.push(...englishWords.map(w => w.toLowerCase()));

  // 常见的业务关键词
  const businessKeywords = [
    '产品', '设计', '教育', '游戏', 'AI', '人工智能', '用户', '体验',
    '战略', '品牌', '市场', '运营', '技术', '开发', '测试', '上线',
    '优化', '迭代', '需求', '功能', '模块', '系统', '平台', '工具',
    'OpenCue', 'OpenQuest', 'Cube', '任运', '任小喵', 'AIMV',
    '组织', '团队', '管理', '培训', '招聘', '绩效', '目标', 'OKR', 'KPI',
    '创意', '内容', '视频', '音乐', '美术', '动画', '3D', '2D',
    '数据', '分析', '指标', '增长', '转化', '留存', '活跃',
    '商业', '模式', '盈利', '成本', '收入', '投资', '融资',
    'RPG', '故事', '讲故事', '角色扮演', '叙事', '剧情', '互动',
    '课程', '学习', '教学', '老师', '学生', '知识', '能力'
  ];

  for (const keyword of businessKeywords) {
    if (text.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  // 去重
  return [...new Set(keywords)];
}
