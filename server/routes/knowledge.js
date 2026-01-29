const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');

// POST /api/knowledge/ask - Ask knowledge base
router.post('/ask', knowledgeController.askQuestion);

// GET /api/knowledge/history - Get QA history
router.get('/history', knowledgeController.getQAHistory);

// PUT /api/knowledge/qa/:id/rate - Rate QA helpful
router.put('/qa/:id/rate', knowledgeController.rateQA);

// POST /api/knowledge/insights/generate - Generate monthly insight
router.post('/insights/generate', knowledgeController.generateMonthlyInsight);

// GET /api/knowledge/insights - Get all monthly insights
router.get('/insights', knowledgeController.getMonthlyInsights);

// GET /api/knowledge/insights/:month - Get monthly insight
router.get('/insights/:month', knowledgeController.getMonthlyInsight);

// PUT /api/knowledge/insights/:month/topics/:topicId - Update topic status
router.put('/insights/:month/topics/:topicId', knowledgeController.updateTopicStatus);

module.exports = router;
