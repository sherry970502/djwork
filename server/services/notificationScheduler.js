const cron = require('node-cron');
const Notification = require('../models/notification');
const OrganizationTask = require('../models/organizationTask');
const IntelligenceReport = require('../models/intelligenceReport');

/**
 * 创建通知的辅助函数
 */
async function createNotification(data) {
  try {
    const notification = new Notification(data);
    await notification.save();
    console.log(`[通知] 已创建: ${data.title}`);
    return notification;
  } catch (error) {
    console.error(`[通知] 创建失败:`, error.message);
    return null;
  }
}

/**
 * 检查本月任务进度
 */
async function checkMonthlyProgress() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 本月第一天和最后一天
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  // 当前日期在本月的进度
  const currentDay = now.getDate();
  const totalDays = endOfMonth.getDate();
  const monthProgress = currentDay / totalDays;

  // 获取本月任务统计
  const totalTasks = await OrganizationTask.countDocuments({
    createdAt: {
      $gte: startOfMonth,
      $lt: new Date(year, month + 1, 1)
    }
  });

  if (totalTasks === 0) {
    return { isWarning: false, progress: 100 };
  }

  const completedTasks = await OrganizationTask.countDocuments({
    createdAt: {
      $gte: startOfMonth,
      $lt: new Date(year, month + 1, 1)
    },
    status: 'completed'
  });

  const taskProgress = completedTasks / totalTasks;

  // 判断：如果月份过半且任务进度低于30%，发出预警
  if (monthProgress > 0.5 && taskProgress < 0.3) {
    return {
      isWarning: true,
      progress: Math.round(taskProgress * 100),
      totalTasks,
      completedTasks
    };
  }

  return { isWarning: false, progress: Math.round(taskProgress * 100) };
}

/**
 * 获取今日新增情报统计
 */
async function getTodayIntelligenceReports() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const reports = await IntelligenceReport.find({
    fetchedAt: {
      $gte: today,
      $lt: tomorrow
    }
  }).populate('keyword', 'keyword');

  return reports;
}

/**
 * 获取上个月的年月字符串
 */
function getLastMonthString() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月`;
}

/**
 * 获取当前月的年月字符串
 */
function getCurrentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
}

/**
 * 初始化所有定时任务
 */
function initScheduler() {
  console.log('[定时任务] 初始化中...');

  // ========== 月末复盘提醒 ==========
  // 每月最后一天 20:00
  // 注意：cron 不直接支持 "L"（最后一天），需要在每天检查
  cron.schedule('0 20 28-31 * *', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 如果明天是下个月的第一天，说明今天是本月最后一天
    if (tomorrow.getDate() === 1) {
      console.log('[定时任务] 执行月末复盘提醒');

      await createNotification({
        type: 'monthly-review',
        title: '📊 月度复盘提醒',
        content: `${getLastMonthString()}的工作计划需要进行复盘总结，点击查看详情`,
        relatedLink: '/monthly-plan',
        priority: 'high',
        metadata: {
          monthYear: getLastMonthString()
        }
      });
    }
  });

  // ========== 月初事务提醒 ==========
  // 每月1日 20:00
  cron.schedule('0 20 1 * *', async () => {
    console.log('[定时任务] 执行月初事务提醒');

    await createNotification({
      type: 'monthly-start',
      title: '🎯 新月开始',
      content: `${getCurrentMonthString()}开始了，请及时处理本月重要事务`,
      relatedLink: '/tasks',
      priority: 'high',
      metadata: {
        monthYear: getCurrentMonthString()
      }
    });
  });

  // ========== 每周进度检查 ==========
  // 每周一 20:00
  cron.schedule('0 20 * * 1', async () => {
    console.log('[定时任务] 执行每周进度检查');

    const progressData = await checkMonthlyProgress();

    if (progressData.isWarning) {
      await createNotification({
        type: 'progress-warning',
        title: '⚠️ 进度预警',
        content: `本月事务进度仅 ${progressData.progress}%（${progressData.completedTasks}/${progressData.totalTasks}），请及时跟进`,
        relatedLink: '/tasks',
        priority: 'high',
        metadata: {
          progress: progressData.progress,
          totalTasks: progressData.totalTasks,
          completedTasks: progressData.completedTasks
        }
      });
    }
  });

  // ========== 每日情报提醒 ==========
  // 每天 20:00
  cron.schedule('0 20 * * *', async () => {
    console.log('[定时任务] 执行每日情报检查');

    const todayReports = await getTodayIntelligenceReports();

    if (todayReports.length > 0) {
      // 提取关键词
      const keywords = [...new Set(
        todayReports
          .map(r => r.keyword?.keyword)
          .filter(Boolean)
      )];

      await createNotification({
        type: 'intelligence-daily',
        title: '📰 今日新增情报',
        content: `今日新增 ${todayReports.length} 条情报（${keywords.slice(0, 3).join('、')}${keywords.length > 3 ? '等' : ''}），点击查看详情`,
        relatedLink: '/intelligence',
        priority: 'medium',
        metadata: {
          count: todayReports.length,
          keywords: keywords
        }
      });
    }
  });

  console.log('[定时任务] 初始化完成');
  console.log('  - 月末复盘提醒: 每月最后一天 20:00');
  console.log('  - 月初事务提醒: 每月1日 20:00');
  console.log('  - 进度检查: 每周一 20:00');
  console.log('  - 每日情报: 每天 20:00');
}

module.exports = {
  initScheduler,
  createNotification,
  checkMonthlyProgress,
  getTodayIntelligenceReports
};
