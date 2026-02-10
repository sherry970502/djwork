const expertConsultantService = require('../services/expertConsultantService');

// 获取所有专家列表
exports.getExperts = async (req, res) => {
  try {
    const experts = expertConsultantService.getExperts();
    res.json({
      success: true,
      data: experts
    });
  } catch (error) {
    console.error('Get experts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取单个专家信息
exports.getExpert = async (req, res) => {
  try {
    const { id } = req.params;
    const expert = expertConsultantService.getExpert(id);
    res.json({
      success: true,
      data: expert
    });
  } catch (error) {
    console.error('Get expert error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// 向专家提问
exports.consultExpert = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, context } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '问题不能为空'
      });
    }

    console.log(`[咨询专家] ${id} - 问题: ${question.substring(0, 50)}...`);

    const result = await expertConsultantService.consultExpert(id, question, context);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Consult expert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 流式咨询（分段返回）
exports.consultExpertStreaming = async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '问题不能为空'
      });
    }

    console.log(`[流式咨询] ${id} - 问题: ${question.substring(0, 50)}...`);

    // 设置响应头为流式传输
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await expertConsultantService.consultExpertStreaming(
      id,
      question,
      (chunk) => {
        // 发送分段数据
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    );

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Streaming consult error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
};
