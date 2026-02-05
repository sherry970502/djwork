import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeChange,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Modal, Input, message, Button, Spin, Typography, Space } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import CreativeNode from './CreativeNode';
import {
  getMindMapByDesignId,
  createMindMap,
  divergeNode,
  updateMindMapNode,
  deleteMindMapNode,
  addManualNode,
} from '../../services/api';

const { Title, Text } = Typography;

const nodeTypes = {
  creative: CreativeNode,
};

interface MindMapCanvasProps {
  designId: string;
  designTitle: string;
}

const MindMapCanvas: React.FC<MindMapCanvasProps> = ({ designId, designTitle }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mindMapId, setMindMapId] = useState<string | null>(null);
  const mindMapIdRef = useRef<string | null>(null); // 使用 ref 存储最新的 mindMapId
  const [loading, setLoading] = useState(true);
  const [diverging, setDiverging] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newNodeContent, setNewNodeContent] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);

  // 加载或创建思维导图
  useEffect(() => {
    loadMindMap();
  }, [designId]);

  // 同步 mindMapId 到 ref，确保回调函数总能访问到最新值
  useEffect(() => {
    mindMapIdRef.current = mindMapId;
    console.log('mindMapId changed:', mindMapId);
  }, [mindMapId]);

  const loadMindMap = async () => {
    try {
      setLoading(true);
      console.log('Loading mind map for designId:', designId);
      const response = await getMindMapByDesignId(designId);
      console.log('getMindMapByDesignId response:', response);

      if (response.data) {
        // 已存在，加载数据
        console.log('Mind map exists, id:', response.data._id);
        setMindMapId(response.data._id);
        convertToReactFlowData(response.data);
      } else {
        // 不存在，创建新的
        console.log('Mind map does not exist, creating new one');
        const createResponse = await createMindMap({
          designId,
          title: designTitle,
        });
        console.log('createMindMap response:', createResponse);
        setMindMapId(createResponse.data._id);
        convertToReactFlowData(createResponse.data);
      }
    } catch (error: any) {
      console.error('Load mind map error:', error);
      message.error('加载失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 转换数据格式
  const convertToReactFlowData = (mindMap: any) => {
    const flowNodes: Node[] = mindMap.nodes.map((node: any) => ({
      id: node.id,
      type: 'creative',
      position: node.position,
      data: {
        label: node.content,
        isMarked: node.isMarked,
        isAIGenerated: node.isAIGenerated,
        level: node.level,
        divergenceType: node.divergenceType,
        onToggleMark: handleToggleMark,
        onDelete: handleDeleteNode,
        onEdit: handleEditNode,
        onAddChild: handleOpenAddModal,
        onDiverge: handleDiverge,
      },
    }));

    const flowEdges: Edge[] = mindMap.edges.map((edge: any) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#D0D0D0', strokeWidth: 2 },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  // 标记/取消标记
  const handleToggleMark = async (nodeId: string) => {
    const currentMindMapId = mindMapIdRef.current;
    console.log('handleToggleMark called:', nodeId, 'mindMapId:', currentMindMapId);
    if (!currentMindMapId) {
      message.warning('思维导图未加载');
      return;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      message.warning('节点不存在');
      return;
    }

    try {
      await updateMindMapNode(currentMindMapId, nodeId, {
        isMarked: !node.data.isMarked,
      });

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isMarked: !n.data.isMarked } }
            : n
        )
      );

      message.success(node.data.isMarked ? '已取消标记' : '已标记 ⭐');
    } catch (error: any) {
      console.error('Toggle mark error:', error);
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // AI 发散
  const handleDiverge = async (nodeId: string) => {
    const currentMindMapId = mindMapIdRef.current;
    console.log('handleDiverge called:', nodeId, 'mindMapId:', currentMindMapId, 'diverging:', diverging);
    if (!currentMindMapId) {
      message.warning('思维导图未加载');
      return;
    }
    if (diverging) {
      message.warning('正在发散中，请稍候');
      return;
    }

    try {
      setDiverging(true);
      message.loading('AI 正在发散创意...', 0);

      const response = await divergeNode(currentMindMapId, nodeId);
      console.log('Diverge response:', response);

      // 添加新节点和边
      const newFlowNodes: Node[] = response.data.nodes.map((node: any) => ({
        id: node.id,
        type: 'creative',
        position: node.position,
        data: {
          label: node.content,
          isMarked: node.isMarked,
          isAIGenerated: node.isAIGenerated,
          level: node.level,
          divergenceType: node.divergenceType,
          onToggleMark: handleToggleMark,
          onDelete: handleDeleteNode,
          onEdit: handleEditNode,
          onAddChild: handleOpenAddModal,
          onDiverge: handleDiverge,
        },
      }));

      const newFlowEdges: Edge[] = response.data.edges.map((edge: any) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#D0D0D0', strokeWidth: 2 },
      }));

      setNodes((nds) => [...nds, ...newFlowNodes]);
      setEdges((eds) => [...eds, ...newFlowEdges]);

      message.destroy();
      message.success(`✨ 已发散 ${newFlowNodes.length} 个创意方向`);
    } catch (error: any) {
      console.error('Diverge error:', error);
      message.destroy();
      const errorMsg = error.response?.data?.message || error.message || '未知错误';
      message.error('发散失败: ' + errorMsg);
    } finally {
      setDiverging(false);
    }
  };

  // 删除节点
  const handleDeleteNode = async (nodeId: string) => {
    const currentMindMapId = mindMapIdRef.current;
    if (!currentMindMapId) return;

    Modal.confirm({
      title: '确定删除此节点？',
      content: '将同时删除所有子节点',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await deleteMindMapNode(currentMindMapId, nodeId);

          // 移除节点和边
          const deletedIds = response.data.deletedNodes;
          setNodes((nds) => nds.filter((n) => !deletedIds.includes(n.id)));
          setEdges((eds) =>
            eds.filter(
              (e) => !deletedIds.includes(e.source) && !deletedIds.includes(e.target)
            )
          );

          message.success('已删除');
        } catch (error: any) {
          message.error('删除失败');
        }
      },
    });
  };

  // 编辑节点
  const handleEditNode = async (nodeId: string, content: string) => {
    const currentMindMapId = mindMapIdRef.current;
    if (!currentMindMapId) return;

    try {
      await updateMindMapNode(currentMindMapId, nodeId, { content });

      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: content } } : n))
      );
    } catch (error: any) {
      message.error('更新失败');
    }
  };

  // 打开添加节点模态框
  const handleOpenAddModal = (parentId: string) => {
    setSelectedParentId(parentId);
    setNewNodeContent('');
    setAddModalOpen(true);
  };

  // 手动添加节点
  const handleAddManualNode = async () => {
    const currentMindMapId = mindMapIdRef.current;
    if (!currentMindMapId || !selectedParentId || !newNodeContent.trim()) return;

    try {
      const response = await addManualNode(currentMindMapId, {
        parentId: selectedParentId,
        content: newNodeContent.trim(),
      });

      const newNode: Node = {
        id: response.data.node.id,
        type: 'creative',
        position: response.data.node.position,
        data: {
          label: response.data.node.content,
          isMarked: false,
          isAIGenerated: false,
          level: response.data.node.level,
          divergenceType: 'vertical',
          onToggleMark: handleToggleMark,
          onDelete: handleDeleteNode,
          onEdit: handleEditNode,
          onAddChild: handleOpenAddModal,
          onDiverge: handleDiverge,
        },
      };

      const newEdge: Edge = {
        id: `${response.data.edge.source}-${response.data.edge.target}`,
        source: response.data.edge.source,
        target: response.data.edge.target,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#D0D0D0', strokeWidth: 2 },
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, newEdge]);

      setAddModalOpen(false);
      message.success('已添加');
    } catch (error: any) {
      message.error('添加失败');
    }
  };

  // 更新节点位置
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // 保存位置变化
      changes.forEach(async (change) => {
        if (change.type === 'position' && change.position && !change.dragging) {
          const currentMindMapId = mindMapIdRef.current;
          if (currentMindMapId) {
            const nodeId = change.id;
            try {
              await updateMindMapNode(currentMindMapId, nodeId, {
                position: change.position,
              });
            } catch (error) {
              console.error('Failed to update position:', error);
            }
          }
        }
      });
    },
    [onNodesChange]
  );

  // 过滤显示
  const displayNodes = showUnmarkedOnly
    ? nodes.filter((n) => n.data.isMarked)
    : nodes;

  const displayEdges = showUnmarkedOnly
    ? edges.filter(
        (e) =>
          displayNodes.some((n) => n.id === e.source) &&
          displayNodes.some((n) => n.id === e.target)
      )
    : edges;

  if (loading) {
    return (
      <div
        style={{
          height: '600px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" tip="加载创意看板..." />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          background: 'rgba(255,255,255,0.95)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <Space direction="vertical" size="small">
          <Title level={5} style={{ margin: 0 }}>
            🎨 创意发散看板
          </Title>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            💡 点击节点 AI 发散 | 右键更多操作
          </Text>
          <Button
            size="small"
            icon={showUnmarkedOnly ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowUnmarkedOnly(!showUnmarkedOnly)}
          >
            {showUnmarkedOnly ? '显示全部' : '只看标记'}
          </Button>
        </Space>
      </div>

      {/* 思维导图画布 */}
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(0, 0, 0, 0.05)"
        />
        <Controls
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.isMarked) return '#FFD700';
            if (node.data.level === 0) return '#667eea';
            if (node.data.isAIGenerated) return '#4facfe';
            return '#a8edea';
          }}
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
      </ReactFlow>

      {/* 手动添加节点模态框 */}
      <Modal
        title="✏️ 添加创意"
        open={addModalOpen}
        onOk={handleAddManualNode}
        onCancel={() => setAddModalOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <Input.TextArea
          autoFocus
          rows={3}
          placeholder="输入你的创意想法..."
          value={newNodeContent}
          onChange={(e) => setNewNodeContent(e.target.value)}
          onPressEnter={(e) => {
            if (e.ctrlKey || e.metaKey) {
              handleAddManualNode();
            }
          }}
        />
        <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
          Ctrl/Cmd + Enter 快速添加
        </Text>
      </Modal>
    </div>
  );
};

export default MindMapCanvas;
