const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const IntelligenceKeyword = require('../models/intelligenceKeyword');
const IntelligenceReport = require('../models/intelligenceReport');

class IntelligenceService {
  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    this.anthropic = new Anthropic({ apiKey: config.claudeApiKey });
    this.model = 'claude-3-haiku-20240307';
  }

  /**
   * 使用 Serper API 搜索最新信息
   */
  async searchWithSerper(query, options = {}) {
    if (!this.serperApiKey) {
      throw new Error('SERPER_API_KEY not configured');
    }

    const {
      num = 10,           // 返回结果数量
      timeRange = 'd',    // d=day, w=week, m=month
      country = 'cn'      // 中国区搜索
    } = options;

    try {
      console.log(`[Serper] 搜索: "${query}"`);

      const response = await axios.post(
        'https://google.serper.dev/search',
        {
          q: query,
          num: num,
          tbs: `qdr:${timeRange}`,  // 时间范围过滤
          gl: country
        },
        {
          headers: {
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const results = response.data;

      console.log(`[Serper] 获取到 ${results.organic?.length || 0} 条结果`);

      return {
        organic: results.organic || [],
        knowledgeGraph: results.knowledgeGraph || null,
        relatedSearches: results.relatedSearches || []
      };

    } catch (error) {
      console.error('[Serper] 搜索失败:', error.message);
      if (error.response?.status === 429) {
        throw new Error('Serper API 配额已用完，请检查配额或升级');
      }
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * AI 分析情报的业务价值
   */
  async analyzeIntelligence(report, keywordInfo) {
    const prompt = `你是 DJ 的战略情报分析助手。请分析以下情报对业务的价值和启发。

## DJ 的业务背景
- 核心业务: AI+教育，通过"快乐、有效、有趣"重塑教育生态
- 核心资产: 游戏基因、AI 生产线、OpenQuest/Cube 平台、自有 IP（任运/任小喵）
- 关注领域: AI 技术、教育创新、游戏化学习、国际化

## 追踪关键词
关键词: ${keywordInfo.keyword}
${keywordInfo.description ? `背景: ${keywordInfo.description}` : ''}

## 情报内容
标题: ${report.title}
摘要: ${report.summary || report.content.substring(0, 500)}
来源: ${report.sourceName}
链接: ${report.sourceUrl}

## 分析任务
请从以下角度分析（每个角度 50-100 字）：

1. **业务价值**: 这条情报对 DJ 的业务有什么直接或间接价值？
2. **关键洞察**: 提取 2-3 个最重要的洞察点（列表形式）
3. **建议行动**: 基于这条情报，建议 DJ 可以采取什么行动？（列表形式，1-3 条）
4. **相关概念**: 从这条情报延伸出的相关概念或方向（列表形式，2-4 个）
5. **潜在议题**: 是否可以衍生出新的战略议题？如果有，简述议题标题和原因（列表形式，0-2 个）

## 输出格式（JSON）
{
  "businessValue": "业务价值分析...",
  "insights": ["洞察1", "洞察2"],
  "actionItems": ["行动1", "行动2"],
  "relatedConcepts": ["概念1", "概念2"],
  "potentialIssues": ["议题标题: 原因"]
}

只输出 JSON，不要其他内容。`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          businessValue: analysis.businessValue || '',
          insights: analysis.insights || [],
          actionItems: analysis.actionItems || [],
          relatedConcepts: analysis.relatedConcepts || [],
          potentialIssues: analysis.potentialIssues || [],
          analyzedAt: new Date()
        };
      }

      return {
        businessValue: '分析失败',
        insights: [],
        actionItems: [],
        relatedConcepts: [],
        potentialIssues: [],
        analyzedAt: new Date()
      };

    } catch (error) {
      console.error('[AI分析] 失败:', error.message);
      return {
        businessValue: `AI 分析失败: ${error.message}`,
        insights: [],
        actionItems: [],
        relatedConcepts: [],
        potentialIssues: [],
        analyzedAt: new Date()
      };
    }
  }

  /**
   * 计算情报评分
   */
  calculateScores(searchResult, keyword) {
    // 相关性评分：基于关键词匹配
    const title = (searchResult.title || '').toLowerCase();
    const snippet = (searchResult.snippet || '').toLowerCase();
    const keywordLower = keyword.toLowerCase();

    let relevanceScore = 50;
    if (title.includes(keywordLower)) relevanceScore += 30;
    if (snippet.includes(keywordLower)) relevanceScore += 20;
    relevanceScore = Math.min(relevanceScore, 100);

    // 热度评分：基于排名位置
    const position = searchResult.position || 1;
    const hotScore = Math.max(100 - position * 5, 20);

    // 新鲜度评分：基于发布时间
    let freshnessScore = 80; // 默认较高，因为已经做了时间范围过滤
    const date = searchResult.date;
    if (date) {
      try {
        const publishDate = new Date(date);
        const now = new Date();
        const hoursAgo = (now - publishDate) / (1000 * 60 * 60);

        if (hoursAgo < 6) freshnessScore = 100;
        else if (hoursAgo < 24) freshnessScore = 90;
        else if (hoursAgo < 72) freshnessScore = 75;
        else freshnessScore = 60;
      } catch (e) {
        // 日期解析失败，使用默认值
      }
    }

    return {
      relevanceScore,
      hotScore,
      freshnessScore
    };
  }

  /**
   * 提取来源网站名称
   */
  extractSourceName(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');

      // 常见网站映射
      const nameMap = {
        'techcrunch.com': 'TechCrunch',
        'theverge.com': 'The Verge',
        '36kr.com': '36氪',
        'jiemian.com': '界面新闻',
        'geekpark.net': '极客公园',
        'infoq.cn': 'InfoQ',
        'ithome.com': 'IT之家',
        'pingwest.com': 'PingWest',
        'leiphone.com': '雷锋网',
        'jiqizhixin.com': '机器之心'
      };

      return nameMap[hostname] || hostname;
    } catch (e) {
      return 'Unknown';
    }
  }

  /**
   * 为关键词获取最新情报
   */
  async fetchIntelligenceForKeyword(keywordId, options = {}) {
    const keyword = await IntelligenceKeyword.findById(keywordId);
    if (!keyword) {
      throw new Error('关键词不存在');
    }

    if (!keyword.isActive) {
      throw new Error('关键词未激活');
    }

    console.log(`[情报获取] 开始为关键词 "${keyword.keyword}" 获取情报`);

    // 使用 searchQuery 或 keyword 作为搜索词
    const searchQuery = keyword.searchQuery || keyword.keyword;

    // 搜索最新信息
    const searchResults = await this.searchWithSerper(searchQuery, {
      num: options.limit || 10,
      timeRange: options.timeRange || 'd'  // 默认最近一天
    });

    // 处理搜索结果
    const reports = [];
    for (const result of searchResults.organic) {
      // 检查是否已存在
      const existing = await IntelligenceReport.findOne({
        sourceUrl: result.link
      });

      if (existing) {
        console.log(`[情报获取] 跳过重复: ${result.title.substring(0, 50)}`);
        continue;
      }

      // 计算评分
      const scores = this.calculateScores(result, keyword.keyword);

      // 创建情报记录（暂不分析）
      const report = new IntelligenceReport({
        keyword: keyword._id,
        title: result.title,
        summary: result.snippet || '',
        content: result.snippet || '',
        sourceUrl: result.link,
        sourceName: this.extractSourceName(result.link),
        publishedAt: result.date ? new Date(result.date) : null,
        fetchedAt: new Date(),
        ...scores
      });

      await report.save();
      reports.push(report);

      console.log(`[情报获取] 新增: ${result.title.substring(0, 50)}`);
    }

    // 更新关键词的最后获取时间和报告计数
    keyword.lastFetchedAt = new Date();
    keyword.reportCount += reports.length;
    await keyword.save();

    console.log(`[情报获取] 完成，新增 ${reports.length} 条情报`);

    return {
      keyword: keyword,
      newReports: reports.length,
      totalReports: keyword.reportCount
    };
  }

  /**
   * 批量分析情报（异步）
   */
  async batchAnalyzeReports(reportIds) {
    console.log(`[批量分析] 开始分析 ${reportIds.length} 条情报`);

    let analyzed = 0;
    for (const reportId of reportIds) {
      try {
        const report = await IntelligenceReport.findById(reportId).populate('keyword');
        if (!report || report.aiAnalysis?.analyzedAt) {
          continue; // 跳过已分析的
        }

        const analysis = await this.analyzeIntelligence(report, report.keyword);
        report.aiAnalysis = analysis;
        await report.save();

        analyzed++;
        console.log(`[批量分析] 已分析 ${analyzed}/${reportIds.length}`);

        // 避免 API 过载，间隔 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`[批量分析] 报告 ${reportId} 分析失败:`, error.message);
      }
    }

    console.log(`[批量分析] 完成，成功分析 ${analyzed} 条`);
    return analyzed;
  }

  /**
   * 为所有激活的关键词获取情报
   */
  async fetchAllActiveKeywords(options = {}) {
    const keywords = await IntelligenceKeyword.find({ isActive: true });

    console.log(`[批量获取] 发现 ${keywords.length} 个激活的关键词`);

    const results = [];
    for (const keyword of keywords) {
      try {
        const result = await this.fetchIntelligenceForKeyword(keyword._id, options);
        results.push(result);

        // 避免 API 过载
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`[批量获取] 关键词 "${keyword.keyword}" 失败:`, error.message);
        results.push({
          keyword: keyword,
          error: error.message,
          newReports: 0
        });
      }
    }

    return results;
  }
}

module.exports = new IntelligenceService();
