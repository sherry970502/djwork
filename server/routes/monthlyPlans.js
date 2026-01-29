const express = require('express');
const router = express.Router();
const monthlyPlanController = require('../controllers/monthlyPlanController');

// 获取所有月度计划列表
router.get('/', monthlyPlanController.getMonthlyPlanList);

// 获取指定月份的计划
router.get('/:month', monthlyPlanController.getMonthlyPlan);

// 同步数据到月度计划
router.post('/:month/sync', monthlyPlanController.syncMonthlyPlan);

// 手动添加计划项目
router.post('/:month/items', monthlyPlanController.addPlanItem);

// 更新计划项目状态
router.put('/:month/items/:itemId', monthlyPlanController.updatePlanItem);

// 更新计划项目的项目分类
router.put('/:month/items/:itemId/project', monthlyPlanController.updateItemProject);

// 删除计划项目
router.delete('/:month/items/:itemId', monthlyPlanController.removePlanItem);

// 迁移单个项目到下个月
router.post('/:month/items/:itemId/migrate', monthlyPlanController.migrateItemToNextMonth);

// 批量迁移项目到下个月
router.post('/:month/migrate', monthlyPlanController.batchMigrateItems);

// AI 复盘单个项目
router.post('/:month/items/:itemId/review', monthlyPlanController.reviewPlanItem);

// AI 复盘整个月度计划
router.post('/:month/review', monthlyPlanController.reviewMonthlyPlan);

module.exports = router;
