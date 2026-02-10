const Project = require('../models/project');
const PersonalDesign = require('../models/personalDesign');
const Thought = require('../models/thought');

// 获取所有项目（树形结构）
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('relatedThoughts', 'content tags')
      .populate('relatedDesigns', 'title status')
      .populate('syncedFromDesign', 'title')
      .sort({ level: 1, order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取项目树（前端便于渲染）
exports.getProjectTree = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('syncedFromDesign', 'title')
      .sort({ level: 1, order: 1, createdAt: 1 })
      .lean();

    // 构建树形结构
    const buildTree = (parentId = null) => {
      return projects
        .filter(p => {
          if (parentId === null) return p.parentId === null;
          return p.parentId && p.parentId.toString() === parentId.toString();
        })
        .map(p => ({
          ...p,
          children: buildTree(p._id)
        }));
    };

    const tree = buildTree(null);

    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('Get project tree error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取单个项目详情
exports.getProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate('relatedThoughts', 'content tags isImportant')
      .populate('relatedDesigns', 'title description status')
      .populate('syncedFromDesign', 'title description status')
      .populate('parentId', 'name');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      });
    }

    // 获取子项目
    const children = await Project.find({ parentId: id })
      .select('name status progress priority level')
      .sort({ order: 1 });

    res.json({
      success: true,
      data: {
        ...project.toObject(),
        children
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 创建项目
exports.createProject = async (req, res) => {
  try {
    const { name, purpose, description, parentId, status, priority, syncedFromDesign } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '项目名称不能为空'
      });
    }

    // 如果有父项目，验证父项目存在
    if (parentId) {
      const parent = await Project.findById(parentId);
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: '父项目不存在'
        });
      }
    }

    // 获取同级最大 order
    const siblings = await Project.find({ parentId: parentId || null }).sort({ order: -1 }).limit(1);
    const order = siblings.length > 0 ? siblings[0].order + 1 : 0;

    const project = new Project({
      name,
      purpose,
      description,
      parentId: parentId || null,
      status: status || 'conception',
      priority: priority || 'medium',
      order,
      syncedFromDesign: syncedFromDesign || null
    });

    await project.save();

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新项目
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      });
    }

    // 不允许直接修改 level 和 path
    delete updates.level;
    delete updates.path;

    // 如果修改了 parentId，需要重新计算 level 和 path
    if (updates.parentId !== undefined && updates.parentId !== project.parentId) {
      if (updates.parentId) {
        // 验证不能将项目移动到自己的子项目下
        const targetParent = await Project.findById(updates.parentId);
        if (!targetParent) {
          return res.status(404).json({
            success: false,
            message: '目标父项目不存在'
          });
        }
        if (targetParent.path.includes(project._id.toString())) {
          return res.status(400).json({
            success: false,
            message: '不能将项目移动到自己的子项目下'
          });
        }
      }
    }

    Object.assign(project, updates);
    project.updatedAt = new Date();
    await project.save();

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除项目（及其所有子项目）
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      });
    }

    // 递归删除所有子项目
    const deleteRecursive = async (projectId) => {
      const children = await Project.find({ parentId: projectId });
      for (const child of children) {
        await deleteRecursive(child._id);
      }
      await Project.findByIdAndDelete(projectId);
    };

    await deleteRecursive(id);

    res.json({
      success: true,
      message: '项目及其子项目已删除'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 从 PersonalDesign 同步创建项目
exports.syncFromDesign = async (req, res) => {
  try {
    const { designId, parentId } = req.body;

    const design = await PersonalDesign.findById(designId);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: '设计不存在'
      });
    }

    // 检查是否已经同步过
    const existingProject = await Project.findOne({ syncedFromDesign: designId });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: '该设计已同步为项目'
      });
    }

    // 获取同级最大 order
    const siblings = await Project.find({ parentId: parentId || null }).sort({ order: -1 }).limit(1);
    const order = siblings.length > 0 ? siblings[0].order + 1 : 0;

    // 创建项目
    const project = new Project({
      name: design.title,
      purpose: design.inspiration || '',
      description: design.description,
      parentId: parentId || null,
      status: 'conception',
      priority: design.priority || 'medium',
      order,
      syncedFromDesign: designId,
      relatedDesigns: [designId],
      relatedThoughts: design.relatedThoughts || [],
      notes: design.notes || ''
    });

    await project.save();

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Sync from design error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 建议项目（基于灵感）
exports.suggestProjects = async (req, res) => {
  try {
    // 获取所有重要的灵感
    const importantThoughts = await Thought.find({ isImportant: true })
      .populate('tags', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    // 获取已存在的项目
    const existingProjects = await Project.find().select('name purpose');

    // TODO: 调用 Claude API 分析灵感，建议可以创建的项目
    // 这里先返回一个简单的结构，后续可以完善 AI 分析逻辑

    const suggestions = [
      {
        name: '基于灵感的项目建议',
        purpose: '根据你的重要灵感，建议创建以下项目',
        relatedThoughts: importantThoughts.slice(0, 5).map(t => t._id),
        reason: '这些灵感具有共同的主题和方向'
      }
    ];

    res.json({
      success: true,
      data: {
        suggestions,
        thoughtCount: importantThoughts.length
      }
    });
  } catch (error) {
    console.error('Suggest projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 调整项目顺序
exports.reorderProjects = async (req, res) => {
  try {
    const { projects } = req.body; // [{ _id, order }, ...]

    if (!projects || !Array.isArray(projects)) {
      return res.status(400).json({
        success: false,
        message: '无效的数据格式'
      });
    }

    // 批量更新
    const updatePromises = projects.map(({ _id, order }) =>
      Project.findByIdAndUpdate(_id, { order, updatedAt: new Date() })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: '顺序更新成功'
    });
  } catch (error) {
    console.error('Reorder projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 建议设计归属位置
exports.suggestPlacement = async (req, res) => {
  try {
    const { designId } = req.body;

    if (!designId) {
      return res.status(400).json({
        success: false,
        message: '缺少设计ID'
      });
    }

    const design = await PersonalDesign.findById(designId);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: '设计不存在'
      });
    }

    // 获取所有项目（构建树形结构描述）
    const allProjects = await Project.find()
      .select('_id name purpose description level parentId')
      .sort({ level: 1, order: 1 });

    // 构建项目树的文本描述
    const buildProjectTree = (parentId = null, indent = 0) => {
      const children = allProjects.filter(p => {
        if (parentId === null) return p.parentId === null;
        return p.parentId && p.parentId.toString() === parentId.toString();
      });

      let treeText = '';
      children.forEach(project => {
        const prefix = '  '.repeat(indent);
        treeText += `${prefix}- ${project.name} (ID: ${project._id})\n`;
        if (project.purpose) {
          treeText += `${prefix}  目的: ${project.purpose}\n`;
        }
        // 递归添加子项目
        treeText += buildProjectTree(project._id, indent + 1);
      });

      return treeText;
    };

    const projectTreeText = buildProjectTree();

    // 调用 Claude API 分析
    const Anthropic = require('@anthropic-ai/sdk');
    const config = require('../config');
    const client = new Anthropic({ apiKey: config.claudeApiKey });

    // 限制项目树文本长度，避免超出 Haiku 上下文限制
    let limitedProjectTreeText = projectTreeText;
    if (projectTreeText.length > 3000) {
      // 如果项目树太大，截取前3000字符并提示
      limitedProjectTreeText = projectTreeText.substring(0, 3000) + '\n... (更多项目已省略)';
    }

    const prompt = `你是一个项目管理助手。我有一个新的设计需要归入项目结构中，请分析它应该放在哪里。

【当前项目结构】
${limitedProjectTreeText || '（目前没有任何项目）'}

【新设计信息】
标题: ${design.title}
描述: ${design.description ? design.description.substring(0, 500) : ''}
${design.inspiration ? `灵感: ${design.inspiration.substring(0, 200)}` : ''}
${design.category ? `分类: ${design.category}` : ''}

【分析要求】
判断此设计应该：
1. 归入现有项目（如果主题相关）
2. 创建为新根项目（如果是全新方向）

返回 JSON：
{
  "recommendation": "existing" 或 "new",
  "parentId": "项目ID" 或 null,
  "parentName": "父项目名" 或 null,
  "reason": "理由（2句话）",
  "confidence": "high" 或 "medium" 或 "low"
}

只返回 JSON。`;

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const suggestion = JSON.parse(jsonText);

    res.json({
      success: true,
      data: {
        designId,
        designTitle: design.title,
        suggestion
      }
    });
  } catch (error) {
    console.error('Suggest placement error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
