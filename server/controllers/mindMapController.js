const MindMap = require('../models/mindMap');
const creativeDivergence = require('../services/creativeDivergence');
const crypto = require('crypto');

// 生成 UUID
const uuidv4 = () => crypto.randomUUID();

// 创建思维导图
exports.createMindMap = async (req, res) => {
  try {
    const { designId, title } = req.body;

    if (!designId || !title) {
      return res.status(400).json({
        success: false,
        message: 'designId and title are required'
      });
    }

    // 创建根节点
    const rootNode = {
      id: uuidv4(),
      content: title,
      parentId: null,
      position: { x: 0, y: 0 },
      isMarked: false,
      isAIGenerated: false,
      level: 0,
      divergenceType: 'root'
    };

    const mindMap = new MindMap({
      designId,
      title,
      nodes: [rootNode],
      edges: []
    });

    await mindMap.save();

    res.json({
      success: true,
      data: mindMap
    });
  } catch (error) {
    console.error('Create mind map error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取思维导图
exports.getMindMap = async (req, res) => {
  try {
    const { id } = req.params;

    const mindMap = await MindMap.findById(id);

    if (!mindMap) {
      return res.status(404).json({
        success: false,
        message: 'Mind map not found'
      });
    }

    res.json({
      success: true,
      data: mindMap
    });
  } catch (error) {
    console.error('Get mind map error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 根据设计ID获取思维导图
exports.getMindMapByDesignId = async (req, res) => {
  try {
    const { designId } = req.params;

    const mindMap = await MindMap.findOne({ designId, status: 'active' });

    res.json({
      success: true,
      data: mindMap
    });
  } catch (error) {
    console.error('Get mind map by design error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 发散节点
exports.divergeNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { nodeId, parentPosition } = req.body;

    const mindMap = await MindMap.findById(id);

    if (!mindMap) {
      return res.status(404).json({
        success: false,
        message: 'Mind map not found'
      });
    }

    // 找到当前节点
    const currentNode = mindMap.nodes.find(n => n.id === nodeId);
    if (!currentNode) {
      return res.status(404).json({
        success: false,
        message: 'Node not found'
      });
    }

    // 使用前端传递的位置（如果提供），否则使用数据库中的位置
    const nodePosition = parentPosition || currentNode.position;
    console.log('🎯 Diverge - Received parentPosition:', parentPosition);
    console.log('🎯 Diverge - DB position:', currentNode.position);
    console.log('🎯 Diverge - Using position:', nodePosition);

    // 构建上下文
    const parentNodes = [];
    let node = currentNode;
    while (node.parentId) {
      const parent = mindMap.nodes.find(n => n.id === node.parentId);
      if (parent) {
        parentNodes.unshift(parent.content);
        node = parent;
      } else {
        break;
      }
    }

    const markedNodes = mindMap.nodes
      .filter(n => n.isMarked)
      .map(n => n.content);

    // 找到根节点（原始需求）
    const rootNode = mindMap.nodes.find(n => n.level === 0);
    const rootContent = rootNode ? rootNode.content : '';

    // AI 发散
    const ideas = await creativeDivergence.divergeFromNode(
      currentNode.content,
      {
        parentNodes,
        markedNodes,
        level: currentNode.level + 1,
        isRoot: currentNode.level === 0,
        rootContent
      }
    );

    // 检查父节点是否已有子节点，计算合理的起始位置
    const existingChildren = mindMap.nodes.filter(n => n.parentId === nodeId);
    let startX = nodePosition.x;

    if (existingChildren.length > 0) {
      // 如果已有子节点，找到最右边的位置
      const maxX = Math.max(...existingChildren.map(n => n.position.x));
      startX = maxX + 250; // 从最右边节点往右250px开始
    } else {
      // 如果没有子节点，从父节点位置开始，居中排列
      startX = nodePosition.x - (ideas.length - 1) * 100;
    }

    // 创建新节点，水平排列避免重叠
    const newNodes = ideas.map((idea, index) => ({
      id: uuidv4(),
      content: idea.content,
      parentId: nodeId,
      position: {
        x: startX + index * 200,
        y: nodePosition.y + 150
      },
      isMarked: false,
      isAIGenerated: true,
      level: currentNode.level + 1,
      divergenceType: idea.type
    }));

    // 创建新边
    const newEdges = newNodes.map(node => ({
      source: nodeId,
      target: node.id
    }));

    // 更新思维导图
    mindMap.nodes.push(...newNodes);
    mindMap.edges.push(...newEdges);
    await mindMap.save();

    res.json({
      success: true,
      data: {
        nodes: newNodes,
        edges: newEdges
      }
    });
  } catch (error) {
    console.error('Diverge node error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新节点
exports.updateNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { nodeId, updates } = req.body;

    const mindMap = await MindMap.findById(id);

    if (!mindMap) {
      return res.status(404).json({
        success: false,
        message: 'Mind map not found'
      });
    }

    const node = mindMap.nodes.find(n => n.id === nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found'
      });
    }

    // 更新节点属性
    Object.assign(node, updates);
    await mindMap.save();

    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    console.error('Update node error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除节点（及其所有子节点）
exports.deleteNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { nodeId } = req.body;

    const mindMap = await MindMap.findById(id);

    if (!mindMap) {
      return res.status(404).json({
        success: false,
        message: 'Mind map not found'
      });
    }

    // 找到所有要删除的节点（包括子孙节点）
    const nodesToDelete = [nodeId];
    let i = 0;
    while (i < nodesToDelete.length) {
      const children = mindMap.nodes
        .filter(n => n.parentId === nodesToDelete[i])
        .map(n => n.id);
      nodesToDelete.push(...children);
      i++;
    }

    // 删除节点和相关的边
    mindMap.nodes = mindMap.nodes.filter(n => !nodesToDelete.includes(n.id));
    mindMap.edges = mindMap.edges.filter(
      e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)
    );

    await mindMap.save();

    res.json({
      success: true,
      data: { deletedNodes: nodesToDelete }
    });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 添加手动节点
exports.addManualNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { parentId, content, position, parentPosition } = req.body;

    const mindMap = await MindMap.findById(id);

    if (!mindMap) {
      return res.status(404).json({
        success: false,
        message: 'Mind map not found'
      });
    }

    const parentNode = mindMap.nodes.find(n => n.id === parentId);
    if (!parentNode) {
      return res.status(404).json({
        success: false,
        message: 'Parent node not found'
      });
    }

    // 使用前端传递的父节点位置（如果提供），否则使用数据库中的位置
    const nodePosition = parentPosition || parentNode.position;

    const newNode = {
      id: uuidv4(),
      content,
      parentId,
      position: position || {
        x: nodePosition.x,
        y: nodePosition.y + 150
      },
      isMarked: false,
      isAIGenerated: false,
      level: parentNode.level + 1,
      divergenceType: 'vertical'
    };

    const newEdge = {
      source: parentId,
      target: newNode.id
    };

    mindMap.nodes.push(newNode);
    mindMap.edges.push(newEdge);
    await mindMap.save();

    res.json({
      success: true,
      data: { node: newNode, edge: newEdge }
    });
  } catch (error) {
    console.error('Add manual node error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除思维导图
exports.deleteMindMap = async (req, res) => {
  try {
    const { id } = req.params;

    await MindMap.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Mind map deleted successfully'
    });
  } catch (error) {
    console.error('Delete mind map error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
