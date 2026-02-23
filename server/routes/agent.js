const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const agentService = require('../services/agentService');
const { AgentConversation } = require('../models');

/**
 * POST /api/agent/chat
 * 处理对话请求
 */
router.post('/chat', async (req, res) => {
  await agentController.chat(req, res);
});

/**
 * GET /api/agent/scenarios
 * 获取快捷场景列表
 */
router.get('/scenarios', (req, res) => {
  const scenarios = agentService.getQuickScenarios();
  res.json({
    success: true,
    data: scenarios
  });
});

/**
 * GET /api/agent/history
 * 获取对话历史
 */
router.get('/history', async (req, res) => {
  try {
    // 目前只维护一个全局对话记录，后续可以扩展为多会话
    let conversation = await AgentConversation.findOne().sort({ lastActiveAt: -1 });

    if (!conversation) {
      conversation = await AgentConversation.create({ messages: [] });
    }

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        messages: conversation.messages || []
      }
    });
  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agent/save
 * 保存对话消息
 */
router.post('/save', async (req, res) => {
  try {
    const { conversationId, messages } = req.body;

    let conversation;
    if (conversationId) {
      conversation = await AgentConversation.findById(conversationId);
    }

    if (!conversation) {
      conversation = await AgentConversation.findOne().sort({ lastActiveAt: -1 });
    }

    if (!conversation) {
      conversation = new AgentConversation({ messages: [] });
    }

    // 更新消息列表
    conversation.messages = messages;
    await conversation.save();

    res.json({
      success: true,
      data: {
        conversationId: conversation._id
      }
    });
  } catch (error) {
    console.error('Save conversation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/agent/history
 * 清空对话历史
 */
router.delete('/history', async (req, res) => {
  try {
    await AgentConversation.deleteMany({});
    res.json({
      success: true,
      message: '对话历史已清空'
    });
  } catch (error) {
    console.error('Clear conversation history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agent/action
 * 执行对话中的操作（如触发 AI 分析）
 */
router.post('/action', async (req, res) => {
  try {
    const { action, params } = req.body;

    // 根据 action 类型执行不同的操作
    switch (action) {
      case 'analyze_task': {
        // 调用组织事务的 AI 分析功能
        const taskController = require('../controllers/taskController');
        await taskController.analyzeTask(req, res);
        break;
      }

      default:
        res.status(400).json({
          success: false,
          error: `未知的操作类型: ${action}`
        });
    }
  } catch (error) {
    console.error('Agent action error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
