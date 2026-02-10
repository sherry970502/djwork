const express = require('express');
const router = express.Router();
const intelligenceController = require('../controllers/intelligenceController');

// ==================== 关键词管理 ====================
router.get('/keywords', intelligenceController.getKeywords);
router.post('/keywords', intelligenceController.createKeyword);
router.put('/keywords/:id', intelligenceController.updateKeyword);
router.delete('/keywords/:id', intelligenceController.deleteKeyword);

// ==================== 情报管理 ====================
router.get('/reports', intelligenceController.getReports);
router.get('/reports/:id', intelligenceController.getReport);
router.post('/reports/:id/bookmark', intelligenceController.toggleBookmark);
router.delete('/reports/:id', intelligenceController.deleteReport);

// ==================== 情报获取 ====================
// 单个关键词获取情报
router.post('/keywords/:keywordId/fetch', intelligenceController.fetchIntelligence);

// 批量获取所有激活关键词的情报
router.post('/fetch-all', intelligenceController.fetchAllIntelligence);

// ==================== AI 分析 ====================
// 分析单个情报
router.post('/reports/:id/analyze', intelligenceController.analyzeReport);

// 批量分析
router.post('/analyze-batch', intelligenceController.batchAnalyze);

// ==================== 统计信息 ====================
router.get('/stats', intelligenceController.getStats);

module.exports = router;
