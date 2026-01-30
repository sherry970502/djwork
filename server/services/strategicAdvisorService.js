const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const { Thought, Tag } = require('../models');

class StrategicAdvisorService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claudeApiKey
    });
    this.model = 'claude-3-haiku-20240307';

    // 核心知识库上下文
    this.contextDictionary = `
企业愿景：通过"AI+教育"重塑全球教育生态，实现"快乐、有效、有趣"的去中心化学习。
核心资产：游戏基因、AI 生产线、OpenQuest/Cube 平台、自有 IP（任运/任小喵）。
经营原则：全球化布局、小版本迭代、价值观正确、AI First。
`;

    this.categoryMap = {
      'business': '业务/产品类',
      'organization': '组织/管理类',
      'strategy': '战略/资本类',
      'brand': '品牌/生态类'
    };

    this.categorySidepoints = {
      'business': '侧重"用户场景"、"AI 生产效率"与"快乐逻辑"',
      'organization': '侧重"AI First 组织进化"、"人才筛选"与"管理熵减"',
      'strategy': '侧重"护城河建设"、"ROI 计算"与"波特五力竞争权力"',
      'brand': '侧重"IP 渗透"、"去中心化愿景"与"社会价值"'
    };
  }

  /**
   * Call Claude API using Anthropic SDK with retry logic
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
        // 如果是过载错误，等待后重试
        if (error.status === 529 && attempt < retries) {
          console.log(`API 过载，等待 ${attempt * 5} 秒后重试 (${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 5000));
          continue;
        }

        if (attempt === retries) {
          throw new Error(`API call failed: ${error.message}`);
        }

        // 其他错误也重试
        console.log(`API 调用失败，重试 (${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
      }
    }
  }

  /**
   * 从知识库中查找相关思考 - 增强版
   * 支持按标签和关键词检索
   */
  async findRelatedThoughts(query, limit = 10) {
    console.log(`[知识库检索] 查询: "${query}"`);

    // 1. 提取关键词（中文分词 + 英文单词）
    const keywords = this.extractKeywords(query);
    console.log(`[知识库检索] 提取关键词: ${keywords.join(', ')}`);

    // 2. 查找匹配的标签（通过 displayName、name 或 keywords 匹配）
    const matchedTags = await Tag.find({
      $or: [
        { displayName: { $in: keywords.map(k => new RegExp(k, 'i')) } },
        { name: { $in: keywords.map(k => new RegExp(k, 'i')) } },
        { keywords: { $in: keywords.map(k => new RegExp(k, 'i')) } }
      ]
    });

    const tagIds = matchedTags.map(t => t._id);
    console.log(`[知识库检索] 匹配到 ${matchedTags.length} 个标签: ${matchedTags.map(t => t.displayName).join(', ')}`);

    // 3. 构建查询条件
    const queryConditions = [];

    // 3.1 按标签查找（优先级最高）
    if (tagIds.length > 0) {
      queryConditions.push({ tags: { $in: tagIds } });
    }

    // 3.2 按关键词在内容中查找
    for (const keyword of keywords) {
      if (keyword.length >= 2) {  // 至少2个字符才搜索
        queryConditions.push({ content: { $regex: keyword, $options: 'i' } });
      }
    }

    // 如果没有任何查询条件，返回空数组
    if (queryConditions.length === 0) {
      console.log(`[知识库检索] 没有有效的查询条件`);
      return [];
    }

    // 4. 执行查询（同时 populate 会议信息）
    const thoughts = await Thought.find({
      isMerged: false,
      $or: queryConditions
    })
    .populate('tags')
    .populate('meetingMinutesId', 'title meetingDate')  // 关联会议标题和日期
    .sort({ isImportant: -1, createdAt: -1 })
    .limit(limit * 2);  // 多获取一些，后面去重

    // 5. 按相关性排序（标签匹配的优先）
    const scoredThoughts = thoughts.map(thought => {
      let score = 0;

      // 标签匹配得分
      const thoughtTagIds = thought.tags.map(t => t._id.toString());
      const matchingTagCount = tagIds.filter(id => thoughtTagIds.includes(id.toString())).length;
      score += matchingTagCount * 10;

      // 关键词匹配得分
      for (const keyword of keywords) {
        if (thought.content.toLowerCase().includes(keyword.toLowerCase())) {
          score += 3;
        }
      }

      // 重要标记加分
      if (thought.isImportant) {
        score += 5;
      }

      return { thought, score };
    });

    // 按得分排序并去重
    scoredThoughts.sort((a, b) => b.score - a.score);
    const uniqueThoughts = [];
    const seenIds = new Set();

    for (const { thought, score } of scoredThoughts) {
      if (!seenIds.has(thought._id.toString()) && uniqueThoughts.length < limit) {
        seenIds.add(thought._id.toString());
        uniqueThoughts.push(thought);
      }
    }

    console.log(`[知识库检索] 最终返回 ${uniqueThoughts.length} 条相关灵感`);
    return uniqueThoughts;
  }

  /**
   * 从文本中提取关键词
   */
  extractKeywords(text) {
    const keywords = [];

    // 1. 提取英文单词（至少2个字符）
    const englishWords = text.match(/[a-zA-Z]{2,}/g) || [];
    keywords.push(...englishWords.map(w => w.toLowerCase()));

    // 2. 提取中文词汇（简单的基于常见词的分词）
    // 常见的业务关键词
    const businessKeywords = [
      '产品', '设计', '教育', '游戏', 'AI', '人工智能', '用户', '体验',
      '战略', '品牌', '市场', '运营', '技术', '开发', '测试', '上线',
      '优化', '迭代', '需求', '功能', '模块', '系统', '平台', '工具',
      'OpenCue', 'OpenQuest', 'Cube', '任运', '任小喵', 'AIMV',
      '组织', '团队', '管理', '培训', '招聘', '绩效', '目标', 'OKR', 'KPI',
      '创意', '内容', '视频', '音乐', '美术', '动画', '3D', '2D',
      '数据', '分析', '指标', '增长', '转化', '留存', '活跃',
      '商业', '模式', '盈利', '成本', '收入', '投资', '融资'
    ];

    for (const keyword of businessKeywords) {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    // 3. 提取引号内的内容
    const quotedMatches = text.match(/["'"']([^"'"']+)["'"']/g) || [];
    for (const match of quotedMatches) {
      const content = match.replace(/["'"']/g, '').trim();
      if (content.length >= 2) {
        keywords.push(content);
      }
    }

    // 4. 去重
    return [...new Set(keywords)];
  }

  /**
   * 分析组织事务任务 - 分阶段调用以获得详尽分析
   */
  async analyzeTask(task, relatedThoughts = []) {
    const thoughtsContext = relatedThoughts.length > 0
      ? relatedThoughts.map((t, i) => `[${i + 1}] ${t.content}`).join('\n')
      : '暂无相关历史思考';

    console.log('开始详尽分析任务:', task.title);

    // 第一阶段：议题分类与 Step 1-2 分析
    const phase1 = await this.analyzePhase1(task, thoughtsContext);
    console.log('Phase 1 完成 - 类别:', phase1.categoryPrediction);

    // 第二阶段：Step 3-4 商业逻辑与执行策略
    const phase2 = await this.analyzePhase2(task, thoughtsContext, phase1);
    console.log('Phase 2 完成');

    // 第三阶段：Step 5-6 用户场景与风险 + 最终建议
    const phase3 = await this.analyzePhase3(task, thoughtsContext, phase1, phase2);
    console.log('Phase 3 完成');

    // 整理引用来源信息
    const referenceSources = this.buildReferenceSources(relatedThoughts);

    // 合并所有分析结果
    const analysis = {
      categoryPrediction: phase1.categoryPrediction,
      categoryLabel: phase1.categoryLabel,
      step1_falsification: phase1.step1_falsification,
      step2_external: phase1.step2_external,
      step3_frameworks: phase2.step3_frameworks,
      step4_execution: phase2.step4_execution,
      step5_userContext: phase3.step5_userContext,
      step6_risk: phase3.step6_risk,
      recommendation: phase3.recommendation,
      relatedThoughts: relatedThoughts.map(t => t._id),
      referenceSources: referenceSources,  // 新增：引用来源详情
      createdAt: new Date()
    };

    return analysis;
  }

  /**
   * 整理引用来源信息
   */
  buildReferenceSources(relatedThoughts) {
    // 按会议分组
    const meetingMap = new Map();
    const thoughtDetails = [];

    for (const thought of relatedThoughts) {
      // 收集灵感详情
      const tags = thought.tags?.map(t => t.displayName || t.name) || [];
      thoughtDetails.push({
        _id: thought._id,
        content: thought.content,
        tags: tags,
        isImportant: thought.isImportant,
        createdAt: thought.createdAt
      });

      // 按会议分组
      if (thought.meetingMinutesId) {
        const meeting = thought.meetingMinutesId;
        const meetingId = meeting._id?.toString() || meeting.toString();

        if (!meetingMap.has(meetingId)) {
          meetingMap.set(meetingId, {
            _id: meetingId,
            title: meeting.title || '未知会议',
            meetingDate: meeting.meetingDate,
            thoughts: []
          });
        }

        meetingMap.get(meetingId).thoughts.push({
          _id: thought._id,
          content: thought.content.substring(0, 100) + (thought.content.length > 100 ? '...' : ''),
          tags: tags
        });
      }
    }

    // 转换为数组并按日期排序
    const meetings = Array.from(meetingMap.values())
      .sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));

    return {
      totalThoughts: relatedThoughts.length,
      meetings: meetings,
      thoughtDetails: thoughtDetails
    };
  }

  /**
   * 第一阶段：议题分类 + Step 1 溯源与证伪 + Step 2 环境与竞争审计
   */
  async analyzePhase1(task, thoughtsContext) {
    const prompt = `你是一位服务于顶层决策者（DJ）的战略决策专家。你融合了 Elon Musk、段永平、Sam Altman 的逻辑。你不仅提供建议，更通过质疑和重构议题来过滤噪音。

## 企业背景
${this.contextDictionary}

## DJ 的灵感知识库（相关历史思考）
${thoughtsContext}

## 待分析议题
标题：${task.title}
描述：${task.description}
来源：${task.source || '组织事务部'}

## 本阶段分析任务

### Step 0：议题预判与分流
判断议题属于哪个维度：
- A. 业务/产品类：侧重"用户场景"、"AI 生产效率"与"快乐逻辑"
- B. 组织/管理类：侧重"AI First 组织进化"、"人才筛选"与"管理熵减"
- C. 战略/资本类：侧重"护城河建设"、"ROI 计算"与"波特五力竞争权力"
- D. 品牌/生态类：侧重"IP 渗透"、"去中心化愿景"与"社会价值"

### Step 1：溯源与证伪 (Why & Falsification)
1. **第一性原理 (Musk)**：剥离行业惯例，深入分析解决问题的核心路径是否只有这一条？有没有更本质的解法？
2. **本分审计 (段永平)**：这是否属于公司的核心能力圈？是否为了短期利益而偏离了长期愿景？详细分析与企业核心资产的契合度。
3. **替代路径**：是否可以通过"不作为（Stop Doing）"或"技术平替"来解决？列举至少 2-3 个替代方案并分析其可行性。

### Step 2：环境与竞争审计 (External Dynamics)
1. **市场环境适配**：分析目标市场的政治、经济、文化（PEST）贴合度，该议题在当前市场环境下的时机是否合适？
2. **竞争态势穿透**：该议题是否能为公司的"教育 IP"或"AI 生产线"带来实质性的增益或壁垒？竞争对手的动向如何？

## 输出格式（JSON）
请输出详尽的分析，每个字段至少 100-200 字的深入分析：
{
  "categoryPrediction": "business|organization|strategy|brand",
  "categoryLabel": "对应中文名称",
  "categorySidepoint": "该类别的分析侧重点",
  "step1_falsification": {
    "firstPrinciple": "详细的第一性原理分析，至少200字...",
    "coreCapabilityFit": "详细的本分审计分析，至少200字...",
    "alternativePaths": ["替代路径1的详细描述", "替代路径2的详细描述", "替代路径3的详细描述"]
  },
  "step2_external": {
    "marketFit": "详细的市场环境适配分析，至少200字...",
    "competitiveAnalysis": "详细的竞争态势穿透分析，至少200字..."
  }
}

只输出 JSON，不要有其他内容。每个分析字段务必详尽深入，体现战略高度。`;

    const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 4096);
    const rawText = response.content[0].text;
    const result = this.parseJsonResponse(rawText, {
      categoryPrediction: 'unknown',
      categoryLabel: '待分类',
      step1_falsification: { firstPrinciple: '', coreCapabilityFit: '', alternativePaths: [] },
      step2_external: { marketFit: '', competitiveAnalysis: '' }
    }, 'Phase 1');

    // 检查是否需要从原始文本提取字段
    const needsExtraction = (
      !result.step1_falsification?.firstPrinciple ||
      result.step1_falsification?.firstPrinciple?.includes('{') ||
      !result.step2_external?.marketFit
    );

    if (needsExtraction) {
      // 如果 firstPrinciple 包含完整 JSON，尝试解析
      const textToExtract = result.step1_falsification?.firstPrinciple?.includes('{')
        ? result.step1_falsification.firstPrinciple
        : rawText;

      try {
        const start = textToExtract.indexOf('{');
        const end = textToExtract.lastIndexOf('}');
        if (start !== -1 && end > start) {
          const nestedJson = JSON.parse(textToExtract.substring(start, end + 1));
          console.log('Phase 1 nested JSON 解析成功');

          if (nestedJson.categoryPrediction) result.categoryPrediction = nestedJson.categoryPrediction;
          if (nestedJson.categoryLabel) result.categoryLabel = nestedJson.categoryLabel;
          if (nestedJson.categorySidepoint) result.categorySidepoint = nestedJson.categorySidepoint;
          if (nestedJson.step1_falsification) result.step1_falsification = nestedJson.step1_falsification;
          if (nestedJson.step2_external) result.step2_external = nestedJson.step2_external;
        }
      } catch (e) {
        console.log('Phase 1 nested JSON 解析失败，使用正则提取');
        this.extractPhase1Fields(textToExtract, result);
      }
    }

    return result;
  }

  /**
   * 第二阶段：Step 3 商业逻辑算法 + Step 4 执行策略与回报评估
   */
  async analyzePhase2(task, thoughtsContext, phase1) {
    const prompt = `你是一位服务于顶层决策者（DJ）的战略决策专家。继续对议题进行深度分析。

## 企业背景
${this.contextDictionary}

## 议题信息
标题：${task.title}
描述：${task.description}
议题类型：${phase1.categoryLabel}（${phase1.categorySidepoint || ''}）

## 前置分析结论
${phase1.step1_falsification?.firstPrinciple ? `第一性原理分析：${phase1.step1_falsification.firstPrinciple.substring(0, 500)}` : ''}

## 本阶段分析任务

### Step 3：商业逻辑算法 (Solid Frameworks)
1. **波特五力模型**：该议题如何改变对竞争对手的议价能力？是否建立了进入壁垒？对供应商、买方、替代品、新进入者、现有竞争的影响分别是什么？
2. **Sam Altman 规模化校验**：是否具备"边际成本递减"特征？是否增加了系统的"智能存量"？能否实现指数级增长？
3. **安索夫矩阵定位**：定位风险级别（市场渗透/产品开发/市场开发/多元化），分析当前选择的战略风险。

### Step 4：执行策略与回报评估 (Execution & ROI)
1. **路径优选**：是否有比自主执行更优的方式？分析战略投资、生态合作、并购、外包等多种路径的优劣。
2. **ROI 计算逻辑**：评估财务回报及战略资产回报（如 IP 影响力、AI 训练数据增量、用户增长等），给出具体的回报预期框架。
3. **核心抓手**：明确成功的关键支点（Leverage Point）在哪里，什么是必须做对的事？

## 输出格式
请用纯文本JSON格式输出（不要使用markdown代码块），确保JSON格式正确：
{"step3_frameworks":{"porterFiveForces":"波特五力分析","scalabilityTest":"规模化校验","ansoffMatrix":"安索夫矩阵"},"step4_execution":{"optimalPath":"路径优选","roiAnalysis":"ROI分析","leveragePoint":"核心抓手"}}`;

    const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 4096);
    const rawText = response.content[0].text;
    const result = this.parseJsonResponse(rawText, {
      step3_frameworks: { porterFiveForces: '', scalabilityTest: '', ansoffMatrix: '' },
      step4_execution: { optimalPath: '', roiAnalysis: '', leveragePoint: '' }
    }, 'Phase 2');

    // 检查是否需要从原始文本提取字段
    const needsExtraction = (
      !result.step3_frameworks?.porterFiveForces ||
      result.step3_frameworks?.porterFiveForces?.includes('{') ||
      !result.step4_execution?.optimalPath
    );

    if (needsExtraction) {
      const textToExtract = result.step3_frameworks?.porterFiveForces?.includes('{')
        ? result.step3_frameworks.porterFiveForces
        : rawText;

      try {
        const start = textToExtract.indexOf('{');
        const end = textToExtract.lastIndexOf('}');
        if (start !== -1 && end > start) {
          const nestedJson = JSON.parse(textToExtract.substring(start, end + 1));
          console.log('Phase 2 nested JSON 解析成功');

          if (nestedJson.step3_frameworks) result.step3_frameworks = nestedJson.step3_frameworks;
          if (nestedJson.step4_execution) result.step4_execution = nestedJson.step4_execution;
        }
      } catch (e) {
        console.log('Phase 2 nested JSON 解析失败，使用正则提取');
        this.extractPhase2Fields(textToExtract, result);
      }
    }

    return result;
  }

  /**
   * 第三阶段：Step 5 用户与场景 + Step 6 风险审计 + 最终建议
   */
  async analyzePhase3(task, thoughtsContext, phase1, phase2) {
    const prompt = `你是一位服务于顶层决策者（DJ）的战略决策专家。这是分析的最后阶段，需要给出风险评估和最终建议。

## 企业背景
${this.contextDictionary}

## 议题信息
标题：${task.title}
描述：${task.description}
议题类型：${phase1.categoryLabel}

## 前置分析摘要
- 第一性原理：${phase1.step1_falsification?.firstPrinciple?.substring(0, 300) || 'N/A'}
- 核心抓手：${phase2.step4_execution?.leveragePoint?.substring(0, 200) || 'N/A'}

## 本阶段分析任务

### Step 5：用户与场景锚定 (User Context)
1. **快乐逻辑**：议题是否缩短了用户获得"成就感"和"幸福感"的距离？
2. **场景匹配**：在教育场景下，该议题的增量价值是什么？

### Step 6：风险审计与反直觉挑战
1. **SWOT 扫描**：优势、劣势、机会、威胁各2-3点
2. **穿透提问**：给出3个直击命门的尖锐问题

### 最终建议
- What：建议做什么
- Why：为什么这样做
- Where：核心抓手在哪
- How Much：代价与回报

## 输出格式
请用纯文本JSON格式输出（不要使用markdown代码块），确保JSON格式正确：
{"step5_userContext":{"happinessLogic":"快乐逻辑","sceneValue":"场景价值"},"step6_risk":{"swot":{"strengths":["优势"],"weaknesses":["劣势"],"opportunities":["机会"],"threats":["威胁"]},"criticalQuestions":["问题1","问题2","问题3"]},"recommendation":{"summary":"总结","whatToDo":"做什么","whyToDo":"为什么","whereToFocus":"聚焦点","costAndReturn":"成本收益"}}`;

    const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 4096);
    const rawText = response.content[0].text;
    const result = this.parseJsonResponse(rawText, {
      step5_userContext: { happinessLogic: '', sceneValue: '' },
      step6_risk: { swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, criticalQuestions: [] },
      recommendation: { summary: '', whatToDo: '', whyToDo: '', whereToFocus: '', costAndReturn: '' }
    }, 'Phase 3');

    // 检查是否需要从原始文本提取字段
    const needsExtraction = (
      !result.step5_userContext?.happinessLogic ||
      result.recommendation?.summary?.includes('{') ||
      result.step6_risk?.criticalQuestions?.length === 0
    );

    if (needsExtraction) {
      const textToExtract = result.recommendation?.summary?.includes('{')
        ? result.recommendation.summary
        : rawText;

      // 尝试方法1：直接解析 JSON
      try {
        const start = textToExtract.indexOf('{');
        const end = textToExtract.lastIndexOf('}');
        if (start !== -1 && end > start) {
          const jsonStr = textToExtract.substring(start, end + 1);
          const nestedJson = JSON.parse(jsonStr);
          console.log('Phase 3 nested JSON 解析成功');

          if (nestedJson.step5_userContext) result.step5_userContext = nestedJson.step5_userContext;
          if (nestedJson.step6_risk) result.step6_risk = nestedJson.step6_risk;
          if (nestedJson.recommendation) result.recommendation = nestedJson.recommendation;
          return result;
        }
      } catch (e) {
        console.log('Phase 3 JSON 解析失败，使用正则提取');
      }

      // 尝试方法2：使用正则提取各字段
      this.extractPhase3Fields(textToExtract, result);
    }

    return result;
  }

  /**
   * 从 JSON 文本中提取指定字段的值（处理转义字符）
   */
  extractJsonStringValue(text, key) {
    // 方法1：匹配到下一个 key 或结束括号之前的所有内容
    const regex1 = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
    const match1 = text.match(regex1);
    if (match1) {
      return match1[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // 方法2：寻找 key 后的冒号和引号，然后找到匹配的结束引号
    const keyIndex = text.indexOf(`"${key}"`);
    if (keyIndex !== -1) {
      const colonIndex = text.indexOf(':', keyIndex);
      if (colonIndex !== -1) {
        const startQuoteIndex = text.indexOf('"', colonIndex);
        if (startQuoteIndex !== -1) {
          let endIndex = startQuoteIndex + 1;
          while (endIndex < text.length) {
            if (text[endIndex] === '"' && text[endIndex - 1] !== '\\') {
              break;
            }
            endIndex++;
          }
          if (endIndex < text.length) {
            const value = text.substring(startQuoteIndex + 1, endIndex);
            return value.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
        }
      }
    }

    return '';
  }

  /**
   * 从 JSON 文本中提取数组字段
   */
  extractJsonArrayValue(text, key) {
    const keyIndex = text.indexOf(`"${key}"`);
    if (keyIndex === -1) return [];

    const colonIndex = text.indexOf(':', keyIndex);
    if (colonIndex === -1) return [];

    const bracketStart = text.indexOf('[', colonIndex);
    if (bracketStart === -1) return [];

    // 找到匹配的结束括号
    let depth = 1;
    let bracketEnd = bracketStart + 1;
    while (bracketEnd < text.length && depth > 0) {
      if (text[bracketEnd] === '[') depth++;
      else if (text[bracketEnd] === ']') depth--;
      bracketEnd++;
    }

    if (depth === 0) {
      const arrayContent = text.substring(bracketStart + 1, bracketEnd - 1);
      // 提取数组中的字符串元素
      const items = [];
      let inString = false;
      let currentItem = '';
      let escapeNext = false;

      for (let i = 0; i < arrayContent.length; i++) {
        const char = arrayContent[i];

        if (escapeNext) {
          currentItem += char;
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          if (inString) {
            // 结束一个字符串
            items.push(currentItem.replace(/\\n/g, ' ').replace(/\\"/g, '"'));
            currentItem = '';
          }
          inString = !inString;
        } else if (inString) {
          currentItem += char;
        }
      }

      return items;
    }

    return [];
  }

  /**
   * 从文本中提取 Phase 1 的各字段
   */
  extractPhase1Fields(text, result) {
    // 提取 categoryPrediction
    const catValue = this.extractJsonStringValue(text, 'categoryPrediction');
    if (catValue && ['business', 'organization', 'strategy', 'brand'].includes(catValue)) {
      result.categoryPrediction = catValue;
    }

    // 提取 categoryLabel
    const labelValue = this.extractJsonStringValue(text, 'categoryLabel');
    if (labelValue) result.categoryLabel = labelValue;

    // Step 1 字段
    const fpValue = this.extractJsonStringValue(text, 'firstPrinciple');
    if (fpValue && fpValue.length > 20) result.step1_falsification.firstPrinciple = fpValue;

    const ccfValue = this.extractJsonStringValue(text, 'coreCapabilityFit');
    if (ccfValue && ccfValue.length > 20) result.step1_falsification.coreCapabilityFit = ccfValue;

    const altPaths = this.extractJsonArrayValue(text, 'alternativePaths');
    if (altPaths.length > 0) result.step1_falsification.alternativePaths = altPaths;

    // Step 2 字段
    const mfValue = this.extractJsonStringValue(text, 'marketFit');
    if (mfValue && mfValue.length > 20) result.step2_external.marketFit = mfValue;

    const caValue = this.extractJsonStringValue(text, 'competitiveAnalysis');
    if (caValue && caValue.length > 20) result.step2_external.competitiveAnalysis = caValue;

    console.log('Phase 1 正则提取完成');
  }

  /**
   * 从文本中提取 Phase 2 的各字段
   */
  extractPhase2Fields(text, result) {
    // Step 3 字段
    const pfValue = this.extractJsonStringValue(text, 'porterFiveForces');
    if (pfValue && pfValue.length > 20) result.step3_frameworks.porterFiveForces = pfValue;

    const stValue = this.extractJsonStringValue(text, 'scalabilityTest');
    if (stValue && stValue.length > 20) result.step3_frameworks.scalabilityTest = stValue;

    const amValue = this.extractJsonStringValue(text, 'ansoffMatrix');
    if (amValue && amValue.length > 20) result.step3_frameworks.ansoffMatrix = amValue;

    // Step 4 字段
    const opValue = this.extractJsonStringValue(text, 'optimalPath');
    if (opValue && opValue.length > 20) result.step4_execution.optimalPath = opValue;

    const roiValue = this.extractJsonStringValue(text, 'roiAnalysis');
    if (roiValue && roiValue.length > 20) result.step4_execution.roiAnalysis = roiValue;

    const lpValue = this.extractJsonStringValue(text, 'leveragePoint');
    if (lpValue && lpValue.length > 20) result.step4_execution.leveragePoint = lpValue;

    console.log('Phase 2 正则提取完成');
  }

  /**
   * 从文本中提取 Phase 3 的各字段
   */
  extractPhase3Fields(text, result) {
    // Step 5 字段
    const hlValue = this.extractJsonStringValue(text, 'happinessLogic');
    if (hlValue && hlValue.length > 10) result.step5_userContext.happinessLogic = hlValue;

    const svValue = this.extractJsonStringValue(text, 'sceneValue');
    if (svValue && svValue.length > 10) result.step5_userContext.sceneValue = svValue;

    // Step 6 SWOT
    const strengths = this.extractJsonArrayValue(text, 'strengths');
    if (strengths.length > 0) result.step6_risk.swot.strengths = strengths;

    const weaknesses = this.extractJsonArrayValue(text, 'weaknesses');
    if (weaknesses.length > 0) result.step6_risk.swot.weaknesses = weaknesses;

    const opportunities = this.extractJsonArrayValue(text, 'opportunities');
    if (opportunities.length > 0) result.step6_risk.swot.opportunities = opportunities;

    const threats = this.extractJsonArrayValue(text, 'threats');
    if (threats.length > 0) result.step6_risk.swot.threats = threats;

    // criticalQuestions
    const cq = this.extractJsonArrayValue(text, 'criticalQuestions');
    if (cq.length > 0) result.step6_risk.criticalQuestions = cq;

    // Recommendation 字段
    const summaryValue = this.extractJsonStringValue(text, 'summary');
    if (summaryValue && summaryValue.length > 10 && !summaryValue.includes('{')) {
      result.recommendation.summary = summaryValue;
    }

    const whatValue = this.extractJsonStringValue(text, 'whatToDo');
    if (whatValue && whatValue.length > 10) result.recommendation.whatToDo = whatValue;

    const whyValue = this.extractJsonStringValue(text, 'whyToDo');
    if (whyValue && whyValue.length > 10) result.recommendation.whyToDo = whyValue;

    const whereValue = this.extractJsonStringValue(text, 'whereToFocus');
    if (whereValue && whereValue.length > 10) result.recommendation.whereToFocus = whereValue;

    const costValue = this.extractJsonStringValue(text, 'costAndReturn');
    if (costValue && costValue.length > 10) result.recommendation.costAndReturn = costValue;

    console.log('Phase 3 正则提取完成');
  }

  /**
   * 解析 JSON 响应，带有健壮的错误处理
   */
  parseJsonResponse(text, defaultValue, phaseName) {
    const trimmed = text.trim();

    // 尝试多种解析策略
    const strategies = [
      // 策略1: 直接解析
      () => JSON.parse(trimmed),
      // 策略2: 提取 JSON 块（贪婪匹配最外层括号）
      () => {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const jsonStr = trimmed.substring(start, end + 1);
          return JSON.parse(jsonStr);
        }
        throw new Error('No JSON found');
      },
      // 策略3: 移除 markdown 代码块后提取
      () => {
        const cleaned = trimmed.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          return JSON.parse(cleaned.substring(start, end + 1));
        }
        throw new Error('No JSON found');
      },
      // 策略4: 修复常见 JSON 格式问题 - 处理字符串内的换行
      () => {
        let fixed = trimmed;
        const start = fixed.indexOf('{');
        if (start > 0) {
          fixed = fixed.substring(start);
        }
        const end = fixed.lastIndexOf('}');
        if (end !== -1) {
          fixed = fixed.substring(0, end + 1);
        }
        // 将字符串值内的换行符替换为空格
        // 匹配 "key": "value with\nnewline" 模式
        fixed = fixed.replace(/:\s*"([^"]*)"/g, (match, content) => {
          const cleanContent = content.replace(/\n/g, ' ').replace(/\s+/g, ' ');
          return `: "${cleanContent}"`;
        });
        fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
      },
      // 策略5: 更激进的修复 - 完全规范化 JSON
      () => {
        let fixed = trimmed;
        const start = fixed.indexOf('{');
        const end = fixed.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('No JSON');
        fixed = fixed.substring(start, end + 1);

        // 使用正则逐步清理
        // 1. 将所有换行替换为空格
        fixed = fixed.replace(/\r?\n/g, ' ');
        // 2. 将多个空格压缩为一个
        fixed = fixed.replace(/\s+/g, ' ');
        // 3. 修复 JSON 格式问题
        fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        return JSON.parse(fixed);
      }
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        console.log(`${phaseName} JSON 解析成功 (策略 ${i + 1})`);
        return result;
      } catch (e) {
        // 继续尝试下一个策略
      }
    }

    // 所有策略都失败，尝试从原始文本中提取嵌套 JSON 并解析其字段
    console.error(`${phaseName} JSON 解析失败，尝试提取嵌套内容`);

    // 尝试提取 JSON 中的各个字段
    const extractedDefault = { ...defaultValue };

    // 提取 categoryPrediction
    const catMatch = trimmed.match(/"categoryPrediction"\s*:\s*"([^"]+)"/);
    if (catMatch && extractedDefault.categoryPrediction !== undefined) {
      extractedDefault.categoryPrediction = catMatch[1];
    }

    // 提取 categoryLabel
    const labelMatch = trimmed.match(/"categoryLabel"\s*:\s*"([^"]+)"/);
    if (labelMatch && extractedDefault.categoryLabel !== undefined) {
      extractedDefault.categoryLabel = labelMatch[1];
    }

    // 提取 firstPrinciple
    const fpMatch = trimmed.match(/"firstPrinciple"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    if (fpMatch && extractedDefault.step1_falsification) {
      extractedDefault.step1_falsification.firstPrinciple = fpMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    }

    // 提取 porterFiveForces
    const pfMatch = trimmed.match(/"porterFiveForces"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    if (pfMatch && extractedDefault.step3_frameworks) {
      extractedDefault.step3_frameworks.porterFiveForces = pfMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    }

    // 如果没有提取到任何内容，使用原始文本
    if (extractedDefault.step1_falsification && !extractedDefault.step1_falsification.firstPrinciple) {
      extractedDefault.step1_falsification.firstPrinciple = trimmed.substring(0, 2000);
    } else if (extractedDefault.step3_frameworks && !extractedDefault.step3_frameworks.porterFiveForces) {
      extractedDefault.step3_frameworks.porterFiveForces = trimmed.substring(0, 2000);
    } else if (extractedDefault.recommendation && !extractedDefault.recommendation.summary) {
      extractedDefault.recommendation.summary = trimmed.substring(0, 2000);
    }

    return extractedDefault;
  }

  /**
   * 知识库问答
   */
  async askKnowledgeBase(question) {
    const relatedThoughts = await this.findRelatedThoughts(question, 15);

    const thoughtsContext = relatedThoughts.length > 0
      ? relatedThoughts.map((t, i) => {
          const tags = t.tags.map(tag => tag.displayName).join(', ');
          return `[${i + 1}] [${tags}] ${t.content}`;
        }).join('\n\n')
      : '知识库中暂无相关内容';

    const prompt = `你是 DJ 的战略顾问助手。请基于 DJ 的灵感知识库内容来回答问题。

## 企业背景
${this.contextDictionary}

## DJ 的灵感知识库（相关内容）
${thoughtsContext}

## 用户问题
${question}

## 回答要求
1. 优先基于知识库中的内容来回答，深度整合和分析相关思考
2. 如果知识库中有直接相关的思考，引用并标注来源编号如 [1]
3. 如果知识库内容不足以回答，可以结合企业背景进行推理
4. 保持战略高度，不涉及执行细节
5. 回答要详尽深入，给出有价值的洞察

请直接回答问题：`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }]);
      const answer = response.content[0].text.trim();

      return {
        answer,
        relatedThoughts: relatedThoughts.map(t => t._id),
        confidence: relatedThoughts.length > 0 ? 0.8 : 0.5
      };
    } catch (error) {
      console.error('Knowledge QA error:', error);
      throw new Error(`Knowledge QA failed: ${error.message}`);
    }
  }

  /**
   * 生成月度洞察
   */
  async generateMonthlyInsight(month, recentThoughts, pendingTasks) {
    const thoughtsContext = recentThoughts.length > 0
      ? recentThoughts.map((t, i) => {
          const tags = t.tags?.map(tag => tag.displayName).join(', ') || '';
          return `[${i + 1}] [${tags}] ${t.content}`;
        }).join('\n\n')
      : '本月暂无新增思考';

    const tasksContext = pendingTasks.length > 0
      ? pendingTasks.map((t, i) => `[${i + 1}] ${t.title}: ${t.description}`).join('\n\n')
      : '暂无待处理任务';

    const prompt = `你是 DJ 的战略顾问。请基于 DJ 本月的思考和待处理任务，进行深度分析并推荐值得 DJ 深入思考的新议题。

## 企业背景
${this.contextDictionary}

## ${month} DJ 的思考记录
${thoughtsContext}

## 当前待处理的组织事务
${tasksContext}

## 任务要求
1. **思考总结**：深入分析本月 DJ 的思考主题、趋势和关注点变化，不少于 300 字
2. **任务关联分析**：分析待处理任务与近期思考的关联，发现潜在的战略一致性或冲突点
3. **推荐议题**：推荐 3-5 个值得 DJ 深入思考的新议题，每个议题应该：
   - 基于近期思考的延伸或深化
   - 填补当前思考的盲区
   - 结合组织事务的战略关联
   - 具有长期价值和战略意义
   - 每个议题的描述和推荐理由至少 100 字

## 输出格式（JSON）
{
  "thoughtsSummary": "本月思考的详尽总结分析，不少于300字...",
  "tasksSummary": "待处理任务与思考的关联分析，不少于200字...",
  "suggestedTopics": [
    {
      "title": "议题标题",
      "description": "议题的详细描述，至少100字...",
      "category": "business|organization|strategy|brand",
      "reasoning": "详细的推荐理由，至少100字...",
      "priority": "high|medium|low"
    }
  ]
}

只输出 JSON，不要有其他内容。请确保JSON格式正确，字符串中不要有未转义的换行符。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }]);
      const responseText = response.content[0].text.trim();

      // 使用健壮的 JSON 解析
      const insight = this.parseInsightResponse(responseText);
      return insight;
    } catch (error) {
      console.error('Monthly insight error:', error);
      throw new Error(`Monthly insight generation failed: ${error.message}`);
    }
  }

  /**
   * 解析月度洞察响应，使用多种策略
   */
  parseInsightResponse(text) {
    const defaultValue = {
      thoughtsSummary: '',
      tasksSummary: '',
      suggestedTopics: []
    };

    // 策略1：直接解析
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('Insight 直接解析失败');
    }

    // 策略2：规范化换行后解析
    try {
      let fixed = text;
      const start = fixed.indexOf('{');
      const end = fixed.lastIndexOf('}');
      if (start !== -1 && end > start) {
        fixed = fixed.substring(start, end + 1);
        // 将换行替换为空格
        fixed = fixed.replace(/\r?\n/g, ' ');
        fixed = fixed.replace(/\s+/g, ' ');
        fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
      }
    } catch (e) {
      console.log('Insight 规范化解析失败');
    }

    // 策略3：使用正则提取各字段
    console.log('使用正则提取 insight 字段');

    const thoughtsSummary = this.extractJsonStringValue(text, 'thoughtsSummary');
    if (thoughtsSummary) defaultValue.thoughtsSummary = thoughtsSummary;

    const tasksSummary = this.extractJsonStringValue(text, 'tasksSummary');
    if (tasksSummary) defaultValue.tasksSummary = tasksSummary;

    // 提取 suggestedTopics 数组
    const topicsMatch = text.match(/"suggestedTopics"\s*:\s*\[([\s\S]*?)\]\s*}/);
    if (topicsMatch) {
      try {
        // 尝试提取每个 topic 对象
        const topicsStr = topicsMatch[1];
        const topics = [];
        const topicRegex = /\{[^{}]*"title"[^{}]*\}/g;
        let match;
        while ((match = topicRegex.exec(topicsStr)) !== null) {
          try {
            // 清理并解析单个 topic
            let topicStr = match[0].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
            const topic = JSON.parse(topicStr);
            topics.push(topic);
          } catch (e) {
            // 尝试用正则提取字段
            const title = this.extractJsonStringValue(match[0], 'title');
            const description = this.extractJsonStringValue(match[0], 'description');
            const category = this.extractJsonStringValue(match[0], 'category');
            const reasoning = this.extractJsonStringValue(match[0], 'reasoning');
            const priority = this.extractJsonStringValue(match[0], 'priority');
            if (title) {
              topics.push({
                title,
                description: description || '',
                category: category || 'business',
                reasoning: reasoning || '',
                priority: priority || 'medium'
              });
            }
          }
        }
        if (topics.length > 0) {
          defaultValue.suggestedTopics = topics;
        }
      } catch (e) {
        console.log('提取 suggestedTopics 失败');
      }
    }

    return defaultValue;
  }
}

module.exports = new StrategicAdvisorService();
