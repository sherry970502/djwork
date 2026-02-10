const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class ExpertConsultantService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claudeApiKey
    });
    this.model = 'claude-3-haiku-20240307';

    // 专家角色库
    this.experts = {
      musk: {
        name: '埃隆·马斯克',
        nameEn: 'Elon Musk',
        avatar: '🚀',
        description: '第一性原理思维、10倍目标、物理边界突破',
        systemPrompt: this.getMuskSystemPrompt()
      }
      // 后续可以添加更多专家
    };
  }

  /**
   * 获取马斯克思维模型的系统提示词
   */
  getMuskSystemPrompt() {
    return `你是一个基于埃隆·马斯克思维方式构建的分析引擎。当用户提出任何问题时，你必须严格按照以下6个思维框架进行结构化分析，每个框架都必须直接回应用户的具体问题，禁止泛泛而谈。

---

## 马斯克核心思维框架

**框架一：打破假设**
识别问题中隐含的传统假设和思维定势，逐一质疑。问：这个问题里哪些"理所当然"其实从未被验证过？

**框架二：第一性原理拆解**
将问题还原到最基本的事实和物理/逻辑约束，剥离所有中间层和行业惯例。从这些基本事实出发，重新推导解法。

**框架三：10倍目标重构**
如果目标不是改善10%而是提升10倍，解决方案会有什么根本性不同？10倍目标会迫使系统性重新设计，而非局部修补。

**框架四：物理边界检验**
区分两类限制：物理定律决定的真实上限，以及人为习惯造成的假性障碍。找出真正的约束在哪里，哪些"不可能"其实只是"没人试过"。

**框架五：行动框架**
给出最快速验证核心假设的具体步骤。优先原型验证而非会议讨论，优先数据反馈而非专家意见。

**框架六：核心洞见**
用马斯克的语气，给出一句最犀利、最反直觉的核心判断。

---

## 输出格式

每次回答必须包含以上六个部分，使用以下标题格式输出：

🧨 **打破假设**
[内容]

⚡ **第一性原理拆解**
[内容]

🚀 **10倍重构**
[内容]

📐 **物理边界检验**
[内容]

⚙️ **行动框架**
[内容]

💡 **核心洞见**
[内容]

---

## 风格要求

- 直接、不废话，必要时听起来近乎疯狂
- 大量使用具体数字和量化表达
- 对"这不可能"的回应是找到物理上允许的路径
- 语气自信、略带挑衅性，拒绝模糊建议
- 禁止使用"这取决于具体情况"等回避性表达

---

## 重要说明

本模型模拟的是马斯克公开表达的思维方式，输出内容为思维框架演练，不代表马斯克本人观点。`;
  }

  /**
   * 调用 Claude API
   */
  async callClaudeAPI(messages, maxTokens = 4096, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          messages: messages
        });

        return response;
      } catch (error) {
        if (error.status === 529 && attempt < retries) {
          console.log(`API 过载，等待 ${attempt * 5} 秒后重试 (${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 5000));
          continue;
        }

        if (attempt === retries) {
          throw new Error(`API call failed: ${error.message}`);
        }

        console.log(`API 调用失败，重试 (${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
      }
    }
  }

  /**
   * 获取所有专家列表
   */
  getExperts() {
    return Object.entries(this.experts).map(([key, expert]) => ({
      id: key,
      name: expert.name,
      nameEn: expert.nameEn,
      avatar: expert.avatar,
      description: expert.description
    }));
  }

  /**
   * 获取单个专家信息
   */
  getExpert(expertId) {
    const expert = this.experts[expertId];
    if (!expert) {
      throw new Error(`Expert not found: ${expertId}`);
    }
    return {
      id: expertId,
      name: expert.name,
      nameEn: expert.nameEn,
      avatar: expert.avatar,
      description: expert.description
    };
  }

  /**
   * 向专家提问 - 支持长文本分段返回
   */
  async consultExpert(expertId, question, context = []) {
    const expert = this.experts[expertId];
    if (!expert) {
      throw new Error(`Expert not found: ${expertId}`);
    }

    console.log(`[专家咨询] ${expert.name} - 问题: ${question.substring(0, 100)}...`);

    // 构建对话历史
    const messages = [];

    // 添加系统提示词作为第一条用户消息
    messages.push({
      role: 'user',
      content: expert.systemPrompt
    });

    // 添加确认消息
    messages.push({
      role: 'assistant',
      content: '我已理解马斯克的思维框架，会按照6个框架进行分析。请提出你的问题。'
    });

    // 添加对话历史（如果有）
    if (context && context.length > 0) {
      // 限制上下文长度，避免超出 Haiku 限制
      const recentContext = context.slice(-4); // 最多保留最近4轮对话
      for (const msg of recentContext) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // 添加当前问题
    messages.push({
      role: 'user',
      content: question
    });

    try {
      // 使用较大的 max_tokens 以获取完整回答
      const response = await this.callClaudeAPI(messages, 4096);

      const answer = response.content[0].text.trim();

      // 检查是否完整（包含所有6个框架）
      const hasAllFrameworks = this.checkFrameworkCompleteness(answer);

      console.log(`[专家咨询] 回答长度: ${answer.length} 字符`);
      console.log(`[专家咨询] 框架完整性: ${hasAllFrameworks ? '完整' : '不完整'}`);

      // 如果回答被截断，尝试继续生成
      if (!hasAllFrameworks && answer.length > 3000) {
        console.log(`[专家咨询] 回答可能不完整，尝试继续生成...`);

        // 添加第一部分回答到对话历史
        messages.push({
          role: 'assistant',
          content: answer
        });

        // 请求继续
        messages.push({
          role: 'user',
          content: '请继续完成剩余的框架分析。'
        });

        const continueResponse = await this.callClaudeAPI(messages, 4096);
        const continuedAnswer = continueResponse.content[0].text.trim();

        console.log(`[专家咨询] 继续部分长度: ${continuedAnswer.length} 字符`);

        // 合并两部分
        const fullAnswer = answer + '\n\n' + continuedAnswer;

        return {
          expertId,
          expertName: expert.name,
          question,
          answer: fullAnswer,
          isComplete: this.checkFrameworkCompleteness(fullAnswer),
          timestamp: new Date()
        };
      }

      return {
        expertId,
        expertName: expert.name,
        question,
        answer,
        isComplete: hasAllFrameworks,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`[专家咨询] 失败:`, error);
      throw new Error(`咨询 ${expert.name} 失败: ${error.message}`);
    }
  }

  /**
   * 检查回答是否包含所有6个框架
   */
  checkFrameworkCompleteness(answer) {
    const frameworks = [
      '打破假设',
      '第一性原理拆解',
      '10倍重构',
      '物理边界检验',
      '行动框架',
      '核心洞见'
    ];

    const foundFrameworks = frameworks.filter(fw => answer.includes(fw));
    return foundFrameworks.length === frameworks.length;
  }

  /**
   * 多轮对话 - 流式返回（备用方案）
   * 如果需要更长的回答，可以分多次调用
   */
  async consultExpertStreaming(expertId, question, onChunk) {
    const expert = this.experts[expertId];
    if (!expert) {
      throw new Error(`Expert not found: ${expertId}`);
    }

    // 分阶段提问，每次获取部分框架
    const stages = [
      {
        prompt: `${question}\n\n请先完成前3个框架的分析：1) 打破假设 2) 第一性原理拆解 3) 10倍重构`,
        frameworks: ['打破假设', '第一性原理拆解', '10倍重构']
      },
      {
        prompt: `请继续完成后3个框架的分析：4) 物理边界检验 5) 行动框架 6) 核心洞见`,
        frameworks: ['物理边界检验', '行动框架', '核心洞见']
      }
    ];

    let fullAnswer = '';

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      console.log(`[专家咨询-流式] 阶段 ${i + 1}/${stages.length}`);

      const messages = [
        {
          role: 'user',
          content: expert.systemPrompt
        },
        {
          role: 'assistant',
          content: '我已理解马斯克的思维框架。'
        },
        {
          role: 'user',
          content: stage.prompt
        }
      ];

      const response = await this.callClaudeAPI(messages, 3000);
      const chunk = response.content[0].text.trim();

      fullAnswer += (i > 0 ? '\n\n' : '') + chunk;

      // 回调函数传递分段结果
      if (onChunk) {
        onChunk({
          stage: i + 1,
          totalStages: stages.length,
          content: chunk,
          frameworks: stage.frameworks
        });
      }
    }

    return {
      expertId,
      expertName: expert.name,
      question,
      answer: fullAnswer,
      isComplete: true,
      timestamp: new Date()
    };
  }
}

module.exports = new ExpertConsultantService();
