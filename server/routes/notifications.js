const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// 获取通知列表
router.get('/', notificationController.getNotifications);

// 获取未读数量
router.get('/unread-count', notificationController.getUnreadCount);

// 标记为已读
router.put('/:id/read', notificationController.markAsRead);

// 批量标记已读
router.post('/mark-all-read', notificationController.markAllAsRead);

// 标记为已处理
router.put('/:id/process', notificationController.markAsProcessed);

// 删除通知
router.delete('/:id', notificationController.deleteNotification);

// 创建通知（测试用）
router.post('/', notificationController.createNotification);

module.exports = router;
