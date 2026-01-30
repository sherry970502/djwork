const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class CreativeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claudeApiKey
    });
    this.model = 'claude-3-haiku-20240307';
  }

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
          console.log(`API overloaded, waiting ${attempt * 5}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 5000));
          continue;
        }
        if (attempt === retries) {
          throw new Error(`API call failed: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
      }
    }
  }

  /**
   * AI 自动筛选维度并生成创意（一站式）
   */
  async generateIdeasWithDimensionSelection(design, allDimensions, relatedThoughts) {
    console.log(`Starting AI dimension selection for design: ${design.title}`);
    console.log(`Total dimensions available: ${allDimensions.length}`);

    const thoughtsContext = relatedThoughts.length > 0
      ? relatedThoughts.map((t, i) => `[${i + 1}] ${t.content}`).join('\n')
      : '暂无相关灵感';

    // 按分类组织维度
    const dimensionsByCategory = {};
    allDimensions.forEach(d => {
      const cat = d.category || '其他';
      if (!dimensionsByCategory[cat]) dimensionsByCategory[cat] = [];
      dimensionsByCategory[cat].push(d);
    });

    // 构建按分类组织的维度列表
    let dimensionsDescription = '';
    Object.entries(dimensionsByCategory).forEach(([category, dims]) => {
      dimensionsDescription += `\n### ${category}\n`;
      dims.forEach(d => {
        dimensionsDescription += `- ${d.displayName}（${d.name}）: ${d.description?.substring(0, 100) || ''}...\n`;
      });
    });

    // 第一步：让 AI 从每个分类中筛选适合的维度
    const selectionPrompt = `你是一位资深的创意总监。请分析以下设计项目，从给定的维度库中筛选出适合用于创意发散的维度。

## 设计项目
标题：${design.title}
描述：${design.description}
${design.inspiration ? `灵感来源：${design.inspiration}` : ''}
${design.goals?.length > 0 ? `目标：${design.goals.join('、')}` : ''}
${design.category ? `类型：${design.category}` : ''}

## 相关灵感（来自 DJ 的知识库）
${thoughtsContext}

## 可用维度库（按分类组织，共 ${allDimensions.length} 个维度）
${dimensionsDescription}

## 任务要求
请仔细分析这个设计项目，从上述各个分类中广泛选择适合的维度进行创意发散。

重要要求：
1. **广泛选择**：请从每个相关的分类中至少选择 1-2 个维度
2. **总数要求**：总共选择 8-15 个维度（根据项目复杂度调整）
3. **全面覆盖**：尽量覆盖用户体验、表现手法、价值观、教育相关等多个分类
4. **相关性**：只排除那些与项目明显无关的维度

## 输出格式（JSON）
{
  "selectedDimensions": ["dimension_name_1", "dimension_name_2", "dimension_name_3", ...],
  "categoryBreakdown": {
    "用户体验": ["选中的维度1", "选中的维度2"],
    "表现手法": ["选中的维度3"],
    ...
  },
  "excludedCategories": ["完全不相关的分类（如果有）"]
}

只输出 JSON，不要有其他内容。`;

    let selectedDimensionNames = [];
    try {
      const selectionResponse = await this.callClaudeAPI([{ role: 'user', content: selectionPrompt }], 4096);
      const selectionResult = this.parseJsonResponse(selectionResponse.content[0].text);
      selectedDimensionNames = selectionResult.selectedDimensions || [];
      console.log(`AI selected ${selectedDimensionNames.length} dimensions: ${selectedDimensionNames.join(', ')}`);

      if (selectionResult.categoryBreakdown) {
        console.log('Category breakdown:', JSON.stringify(selectionResult.categoryBreakdown));
      }
    } catch (error) {
      console.error('Dimension selection failed, using default selection:', error);
      // 失败时从每个分类选择前2个
      Object.values(dimensionsByCategory).forEach(dims => {
        dims.slice(0, 2).forEach(d => selectedDimensionNames.push(d.name));
      });
    }

    // 筛选出选中的维度对象
    let selectedDimensions = allDimensions.filter(d =>
      selectedDimensionNames.includes(d.name)
    );

    // 如果选中的太少，补充更多
    if (selectedDimensions.length < 5) {
      console.log(`Only ${selectedDimensions.length} dimensions matched, adding more from each category`);
      const selectedIds = new Set(selectedDimensions.map(d => d._id.toString()));
      Object.values(dimensionsByCategory).forEach(dims => {
        dims.forEach(d => {
          if (!selectedIds.has(d._id.toString()) && selectedDimensions.length < 10) {
            selectedDimensions.push(d);
            selectedIds.add(d._id.toString());
          }
        });
      });
    }

    console.log(`Final selection: ${selectedDimensions.length} dimensions`);

    // 第二步：为每个选中的维度生成创意
    return await this.generateDimensionIdeas(design, selectedDimensions, relatedThoughts);
  }

  /**
   * 为每个维度生成创意想法
   */
  async generateDimensionIdeas(design, dimensions, relatedThoughts) {
    const dimensionIdeas = [];

    const thoughtsContext = relatedThoughts.length > 0
      ? relatedThoughts.map((t, i) => `[${i + 1}] ${t.content}`).join('\n')
      : '暂无相关灵感';

    for (const dimension of dimensions) {
      console.log(`Generating ideas for dimension: ${dimension.displayName}`);

      const promptsText = dimension.prompts?.length > 0
        ? dimension.prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')
        : '从这个维度思考有什么可能性？';

      const examplesText = dimension.examples?.length > 0
        ? dimension.examples.map(e => `- ${e.title}: ${e.description}`).join('\n')
        : '暂无参考案例';

      const prompt = `你是一位极具创意的设计顾问。请从【${dimension.displayName}】这个维度，为以下设计项目发散创意。

## 设计项目
标题：${design.title}
描述：${design.description}
${design.inspiration ? `灵感来源：${design.inspiration}` : ''}
${design.goals?.length > 0 ? `目标：${design.goals.join('、')}` : ''}

## 维度说明
维度名称：${dimension.displayName}
维度描述：${dimension.description}

### 思考角度
${promptsText}

### 参考案例
${examplesText}

## 相关灵感（来自 DJ 的知识库）
${thoughtsContext}

## 任务要求
请从【${dimension.displayName}】这个维度出发，为这个设计项目提供 3-5 个创意想法。每个想法需要：
1. 有一个吸引人的标题
2. 详细描述这个创意如何实现
3. 评估可行性（high/medium/low）
4. 评估创新程度（high/medium/low）

最后请总结这个维度能为设计带来的核心价值。

## 输出格式（JSON）
{
  "ideas": [
    {
      "title": "创意标题",
      "description": "详细描述，至少 50 字...",
      "feasibility": "high|medium|low",
      "innovation": "high|medium|low"
    }
  ],
  "summary": "这个维度的核心价值总结"
}

只输出 JSON，不要有其他内容。`;

      try {
        const response = await this.callClaudeAPI([{ role: 'user', content: prompt }]);
        const result = this.parseJsonResponse(response.content[0].text);

        dimensionIdeas.push({
          dimensionId: dimension._id,
          dimensionName: dimension.displayName,
          ideas: result.ideas || [],
          summary: result.summary || '',
          generatedAt: new Date()
        });
      } catch (error) {
        console.error(`Failed to generate ideas for ${dimension.displayName}:`, error);
        dimensionIdeas.push({
          dimensionId: dimension._id,
          dimensionName: dimension.displayName,
          ideas: [],
          summary: `生成失败: ${error.message}`,
          generatedAt: new Date()
        });
      }

      // 避免 API 过载
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return dimensionIdeas;
  }

  /**
   * 生成综合创意方案
   */
  async generateCreativeProposal(design) {
    const dimensionSummaries = design.dimensionIdeas.map(di => {
      const ideasText = di.ideas.map(idea =>
        `- ${idea.title}: ${idea.description} (可行性: ${idea.feasibility}, 创新: ${idea.innovation})`
      ).join('\n');
      return `### ${di.dimensionName}\n${ideasText}\n总结: ${di.summary}`;
    }).join('\n\n');

    const prompt = `你是一位资深的创意总监。基于以下多维度的创意发散结果，请为设计项目生成一个综合的创意方案。

## 设计项目
标题：${design.title}
描述：${design.description}
${design.inspiration ? `灵感来源：${design.inspiration}` : ''}
${design.goals?.length > 0 ? `目标：${design.goals.join('、')}` : ''}

## 各维度创意发散结果
${dimensionSummaries}

## 任务要求
请综合以上各维度的创意想法，生成一个完整的创意方案。这个方案应该：
1. 融合多个维度的优秀创意
2. 形成一个连贯、可执行的整体方案
3. 具有独特的价值主张
4. 考虑目标受众和实现路径

## 输出格式（JSON）
{
  "title": "方案标题",
  "coreIdea": "核心创意（100-200字）",
  "uniqueValue": "独特价值主张",
  "targetAudience": "目标受众描述",
  "keyFeatures": ["特性1", "特性2", "特性3"],
  "implementationSteps": [
    {"step": 1, "title": "步骤标题", "description": "步骤描述"},
    {"step": 2, "title": "步骤标题", "description": "步骤描述"},
    {"step": 3, "title": "步骤标题", "description": "步骤描述"}
  ],
  "potentialChallenges": ["挑战1", "挑战2"],
  "inspirationSources": ["来自XX维度的YY创意", "来自XX维度的YY创意"]
}

只输出 JSON，不要有其他内容。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }]);
      const result = this.parseJsonResponse(response.content[0].text);

      return {
        ...result,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to generate proposal:', error);
      throw error;
    }
  }

  /**
   * 生成需求澄清问题 - 基于深度理解的版本
   */
  async generateClarifyingQuestions(design) {
    console.log(`Generating clarifying questions based on deep understanding for: ${design.title}`);

    const prompt = `你是一位资深的设计思维教练。用户提出了一个设计想法，你需要先深度理解这个想法的出发点，然后设计精准的问题帮助澄清需求。

## 用户的设计想法
标题：${design.title}
描述：${design.description}
${design.category ? `类型：${design.category}` : ''}
${design.inspiration ? `灵感来源：${design.inspiration}` : ''}
${design.goals?.length > 0 ? `目标：${design.goals.join('、')}` : ''}

## 第一步：深度理解这个设计的出发点

请先思考：
1. 用户为什么会想做这个设计？背后的动机和触发点可能是什么？
2. 这个设计想要解决什么问题，或者创造什么价值？
3. 从描述来看，用户心中可能已经有了哪些隐含的假设或偏好？
4. 这个设计的独特之处在哪里？与常见方案有什么不同？

## 第二步：基于你的理解，设计 5-6 个澄清问题

每个问题都要：
1. **基于对这个具体设计的理解**来提问，而不是套用通用模板
2. **选项要体现你对这个设计的深度思考**，每个选项都是这个设计可能的具体方向
3. **帮助用户明确自己可能还没想清楚的点**

### 关于目标用户的问题
不要问"目标用户是谁"这种泛泛的问题。
而是基于这个设计，思考：谁会使用/接触这个设计？他们在什么状态下接触？他们期待从中获得什么？
然后针对性地提问，选项要是这个设计场景下具体的用户画像或使用状态。

### 关于核心价值的问题
不要问"核心价值是什么"这种泛泛的问题。
而是基于这个设计，思考：这个设计可能带来的价值有哪些不同维度？用户最看重的可能是哪个？
然后针对性地提问，选项要是这个设计可能提供的具体价值点。

### 关于使用场景的问题
不要问"在什么场景使用"这种泛泛的问题。
而是基于这个设计，思考：这个设计会在什么具体情境下被体验？不同情境会如何影响设计方向？
然后针对性地提问，选项要是这个设计的具体使用情境。

### 关于设计取舍的问题
基于这个设计，一定会面临一些取舍。比如：风格上的取舍、功能上的取舍、体验上的取舍。
针对这个设计最关键的取舍点提问。

## 示例（假设用户想设计"为母亲设计一个雕像放在公司园区"）

好的问题示例：

Q1 - 关于情感定位：
"你希望员工看到这座雕像时，内心升起的第一反应是什么？"
选项：
- "想起自己的母亲，感到温暖和思念"
- "感受到一种被保护、被关爱的安全感"
- "联想到公司的创业精神和孕育成长的力量"
- "体会到生命传承和感恩回馈的意义"

Q2 - 关于风格取舍：
"这座雕像的艺术风格，你倾向于哪个方向？"
选项：
- "写实温情——真实的母亲形象，让人感到亲切"
- "抽象象征——用抽象造型传达母爱的意境"
- "现代简约——简洁有力的线条，融入现代园区"
- "传统庄重——经典的纪念碑式设计，庄严肃穆"

Q3 - 关于互动体验：
"员工与这座雕像的关系，你期望是怎样的？"
选项：
- "静静地欣赏和沉思，保持一定距离感"
- "可以靠近、触摸，感受材质的温度"
- "有互动元素，比如可以留言或献花"
- "成为日常路过的风景，潜移默化地影响"

## 输出格式（JSON）
{
  "understanding": {
    "possibleMotivation": "基于描述，我理解用户做这个设计的出发点可能是...",
    "impliedPreferences": ["用户似乎已经有的偏好1", "偏好2"],
    "unclearPoints": ["还不清楚的关键点1", "关键点2", "关键点3"]
  },
  "questions": [
    {
      "category": "emotion|style|interaction|value|tradeoff|context",
      "question": "基于对这个设计的理解提出的具体问题",
      "questionType": "single",
      "options": [
        "这个设计的具体方向选项1",
        "这个设计的具体方向选项2",
        "这个设计的具体方向选项3",
        "这个设计的具体方向选项4"
      ],
      "whyAsk": "为什么需要澄清这个点"
    }
  ]
}

重要提醒：
- 每个问题和选项都必须紧扣这个具体的设计，不能是通用的模板
- 选项应该是这个设计真实可能的方向，让用户看到后觉得"这几个选项都很贴合我的设计"
- 不要用"其他"作为选项

只输出 JSON，不要有其他内容。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 6000);
      const result = this.parseJsonResponse(response.content[0].text);

      console.log(`Generated ${result.questions?.length || 0} clarifying questions`);
      if (result.understanding) {
        console.log('Understanding:', result.understanding.possibleMotivation?.substring(0, 100));
      }
      return result;
    } catch (error) {
      console.error('Failed to generate clarifying questions:', error);
      // 返回基础默认问题
      return {
        understanding: {
          possibleMotivation: '需要进一步了解',
          impliedPreferences: [],
          unclearPoints: ['设计的核心目标', '期望的用户体验', '关键的设计取舍']
        },
        questions: [
          {
            category: 'value',
            question: '这个设计最想传达或实现的核心是什么？',
            questionType: 'single',
            options: [
              '传达某种情感或理念',
              '解决某个具体问题',
              '创造独特的体验',
              '满足特定人群的需求'
            ],
            whyAsk: '明确核心才能让后续设计有方向'
          },
          {
            category: 'style',
            question: '在设计风格上，你的直觉倾向是？',
            questionType: 'single',
            options: [
              '简约现代，less is more',
              '丰富细腻，注重细节',
              '大胆创新，突破常规',
              '经典传统，稳重可靠'
            ],
            whyAsk: '风格定位影响整体设计语言'
          },
          {
            category: 'tradeoff',
            question: '如果必须做取舍，你更看重？',
            questionType: 'single',
            options: [
              '独特性——哪怕小众也要与众不同',
              '普适性——让更多人能接受和喜欢',
              '深度——在某一点上做到极致',
              '广度——覆盖更多场景和需求'
            ],
            whyAsk: '取舍决定了设计的优先级'
          }
        ]
      };
    }
  }

  /**
   * 根据澄清问答生成需求摘要 - 深度洞察版
   */
  async generateRequirementSummary(design) {
    const qaContext = design.clarifyingQA?.map(qa => {
      const answers = qa.answer?.join('、') || qa.customAnswer || '未回答';
      const categoryLabels = {
        essence: '本质追问',
        assumption: '假设验证',
        blindspot: '盲点揭示',
        tradeoff: '取舍决策',
        risk: '风险预判',
        success: '成功标准'
      };
      const catLabel = categoryLabels[qa.category] || qa.category;
      return `【${catLabel}】\nQ: ${qa.question}\nA: ${answers}${qa.customAnswer ? `\n补充: ${qa.customAnswer}` : ''}`;
    }).join('\n\n') || '';

    if (!qaContext) {
      return null;
    }

    const prompt = `你是一位资深的产品战略顾问。请根据用户的设计想法和他们对深度问题的回答，生成一份高质量的需求洞察报告。

## 原始设计想法
标题：${design.title}
描述：${design.description}
${design.inspiration ? `灵感来源：${design.inspiration}` : ''}
${design.goals?.length > 0 ? `目标：${design.goals.join('、')}` : ''}

## 用户对深度问题的回答
${qaContext}

## 你的任务
请生成一份 300-400 字的需求洞察报告，不要简单罗列，而是要：

1. **核心洞察**（2-3句话）
   - 基于用户的回答，揭示这个设计真正想要实现的本质目标
   - 用户可能自己都没清晰意识到的深层需求

2. **设计方向建议**（3-4个要点）
   - 基于用户的选择，给出明确的设计方向建议
   - 每个建议要具体可执行

3. **需要注意的风险**（2-3个）
   - 基于用户的回答，指出可能存在的风险或矛盾
   - 给出规避建议

4. **关键成功要素**（2-3个）
   - 这个设计要成功，最关键的几个因素是什么

请用专业但易懂的语言，直接输出报告文本。不要用标题分隔，而是用自然的段落过渡。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 2048);
      return response.content[0].text.trim();
    } catch (error) {
      console.error('Failed to generate requirement summary:', error);
      return null;
    }
  }

  parseJsonResponse(text) {
    let trimmed = text.trim();

    // 移除 markdown 代码块标记
    trimmed = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    trimmed = trimmed.trim();

    // 尝试直接解析
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      console.log('Direct JSON parse failed, trying to extract...');
    }

    // 尝试提取 JSON 块
    try {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start !== -1 && end > start) {
        let jsonStr = trimmed.substring(start, end + 1);

        // 清理常见问题
        // 1. 移除控制字符
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
        // 2. 规范化换行和空格
        jsonStr = jsonStr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
        // 3. 修复尾随逗号
        jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        return JSON.parse(jsonStr);
      }
    } catch (e) {
      console.log('JSON extraction failed:', e.message);
    }

    // 尝试用正则提取 ideas 数组
    try {
      const ideasMatch = trimmed.match(/"ideas"\s*:\s*\[([\s\S]*?)\]/);
      const summaryMatch = trimmed.match(/"summary"\s*:\s*"([^"]+)"/);

      if (ideasMatch) {
        // 尝试解析 ideas 数组
        let ideasStr = '[' + ideasMatch[1] + ']';
        ideasStr = ideasStr.replace(/[\x00-\x1F\x7F]/g, ' ')
                          .replace(/\r?\n/g, ' ')
                          .replace(/\s+/g, ' ')
                          .replace(/,\s*]/g, ']');

        const ideas = JSON.parse(ideasStr);
        return {
          ideas: ideas,
          summary: summaryMatch ? summaryMatch[1] : '解析部分成功'
        };
      }
    } catch (e) {
      console.log('Regex extraction failed:', e.message);
    }

    // 最后尝试：提取任何看起来像创意的内容
    const fallbackIdeas = [];
    const titleMatches = trimmed.matchAll(/"title"\s*:\s*"([^"]+)"/g);
    const descMatches = trimmed.matchAll(/"description"\s*:\s*"([^"]+)"/g);

    const titles = [...titleMatches].map(m => m[1]);
    const descs = [...descMatches].map(m => m[1]);

    for (let i = 0; i < Math.min(titles.length, descs.length); i++) {
      fallbackIdeas.push({
        title: titles[i],
        description: descs[i],
        feasibility: 'medium',
        innovation: 'medium'
      });
    }

    if (fallbackIdeas.length > 0) {
      console.log(`Fallback extraction found ${fallbackIdeas.length} ideas`);
      return {
        ideas: fallbackIdeas,
        summary: '通过备用方式提取的创意'
      };
    }

    // 返回默认值，但不把原始 JSON 放到 summary
    console.log('All parsing methods failed, returning empty result');
    return {
      ideas: [],
      summary: '创意生成失败，请重试'
    };
  }
}

module.exports = new CreativeService();
