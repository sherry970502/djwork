const XLSX = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const config = require('../config');

const DesignDimension = require('../models/designDimension');

// 分类颜色映射
const categoryColors = {
  '用户体验': '#4facfe',
  '表现手法': '#667eea',
  '价值观': '#f093fb',
  '教育相关': '#38ef7d',
  '游戏化相关': '#ff6b6b',
  '外部带来的': '#feca57',
  '操作方式': '#54a0ff',
  '角色特点': '#5f27cd',
  'IP带来的': '#00d2d3',
  'AI带来的': '#ff9ff3',
  '元宇宙带来的': '#c8d6e5',
  '艺术带来的': '#ee5a24',
  '剧本内容': '#10ac84'
};

// 分类图标映射
const categoryIcons = {
  '用户体验': 'star',
  '表现手法': 'bulb',
  '价值观': 'book',
  '教育相关': 'book',
  '游戏化相关': 'rocket',
  '外部带来的': 'global',
  '操作方式': 'tool',
  '角色特点': 'user',
  'IP带来的': 'crown',
  'AI带来的': 'robot',
  '元宇宙带来的': 'appstore',
  '艺术带来的': 'picture',
  '剧本内容': 'file-text'
};

// 将中文名称转换为英文标识
function toEnglishName(chineseName) {
  const pinyin = {
    '节日氛围': 'festival_atmosphere',
    '可信度': 'credibility',
    '稀缺感': 'scarcity',
    '设计思考': 'design_thinking',
    '安全性': 'safety',
    '刻意的重复标准化': 'deliberate_repetition',
    '优雅的态度': 'elegant_attitude',
    '对动作的描述（如轻拿轻放）': 'action_description',
    '素养的维度': 'literacy_dimension',
    '过程的快乐': 'process_joy',
    '拟人化': 'personification',
    '关联符号设计': 'associative_symbol',
    '科学设计': 'scientific_design',
    '超纲设计': 'beyond_curriculum',
    '情绪价值': 'emotional_value',
    '全局观': 'global_view',
    '暴力': 'violence',
    '情色/开车': 'adult_content',
    '传播性': 'virality',
    '学费值得': 'worth_tuition',
    '好记忆': 'memorable',
    '戏剧性': 'dramatic',
    '财富感': 'wealth_feeling',
    '视觉糖果': 'visual_candy',
    '专业感': 'professionalism',
    '促销': 'promotion',
    '喜闻乐见的八卦': 'gossip',
    '美学震撼性': 'aesthetic_impact',
    '世界观': 'worldview',
    '增加反馈': 'add_feedback',
    '角色价值观': 'character_values',
    '青少年的体验': 'youth_experience',
    '业界专业的点评': 'professional_review',
    '搞笑': 'funny',
    '冲突': 'conflict',
    '夸张': 'exaggeration',
    '我们鼓励的态度/行为': 'encouraged_behavior',
    '代入感': 'immersion',
    '有趣/好玩': 'fun',
    '成长感': 'growth_feeling',
    '蹭流量（热梗）': 'trending_memes',
    '创新': 'innovation',
    '任运和朋友们': 'renyun_friends',
    '元宇宙': 'metaverse',
    '国际化适配': 'internationalization',
    '艺术性': 'artistry',
    '国际文化礼仪': 'cultural_etiquette',
    '硬件操作': 'hardware_interaction',
    '乐观': 'optimism',
    '幽默': 'humor',
    '豪华感': 'luxury_feeling',
    '多感官的体验感': 'multi_sensory',
    '仪式感': 'ritual_feeling',
    '被打动的感觉': 'being_touched',
    '颜值': 'aesthetics',
    '新鲜感': 'freshness'
  };
  return pinyin[chineseName] || chineseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').toLowerCase();
}

async function importDimensions() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('MongoDB connected');

    // 读取 xlsx 文件
    const workbook = XLSX.readFile('/Users/superpotato/Desktop/设计维度列表.xlsx');
    const sheet = workbook.Sheets['MainData'];
    const range = XLSX.utils.decode_range(sheet['!ref']);

    const dimensions = [];
    for (let r = 5; r <= range.e.r; r++) {
      const getCell = (c) => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        return cell ? String(cell.v).trim() : '';
      };

      const displayName = getCell(1);  // 思考维度名称
      const definition = getCell(3);   // 思考维度的定义
      const purpose = getCell(4);      // 这个维度的目的
      const category = getCell(6);     // 维度所属分类Label

      if (displayName) {
        dimensions.push({
          displayName,
          definition,
          purpose,
          category
        });
      }
    }

    console.log(`Found ${dimensions.length} dimensions in xlsx`);

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i];
      const name = toEnglishName(dim.displayName);

      // 检查是否已存在
      const existing = await DesignDimension.findOne({ name });
      if (existing) {
        console.log(`Skipped (exists): ${dim.displayName}`);
        skipped++;
        continue;
      }

      // 构建描述
      let description = dim.definition || '';
      if (dim.purpose) {
        description += description ? `\n\n目的：${dim.purpose}` : dim.purpose;
      }

      // 根据定义和目的生成思考角度
      const prompts = [];
      if (dim.definition) {
        prompts.push(`如何在设计中体现「${dim.displayName}」？`);
        prompts.push(`${dim.displayName}能为用户带来什么价值？`);
      }
      prompts.push(`有哪些方式可以增强${dim.displayName}？`);
      prompts.push(`如何让${dim.displayName}更加突出？`);

      const newDimension = new DesignDimension({
        name,
        displayName: dim.displayName,
        description: description || `${dim.displayName}相关的设计考量`,
        prompts,
        examples: [],
        color: categoryColors[dim.category] || '#667eea',
        icon: categoryIcons[dim.category] || 'bulb',
        isActive: true,
        sortOrder: i + 10  // 留出前面的位置给预设维度
      });

      await newDimension.save();
      console.log(`Imported: ${dim.displayName} (${dim.category})`);
      imported++;
    }

    console.log(`\nImport complete: ${imported} imported, ${skipped} skipped`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

importDimensions();
