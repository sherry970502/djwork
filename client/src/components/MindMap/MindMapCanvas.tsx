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

  // 发散引导相关
  const [divergeModalOpen, setDivergeModalOpen] = useState(false);
  const [divergeNodeId, setDivergeNodeId] = useState<string | null>(null);
  const [userGuidance, setUserGuidance] = useState('');

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

    try {
      // 乐观更新 UI - 立即切换状态，使用函数式更新获取最新 nodes
      let wasMarked = false;
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (n.id === nodeId) {
            wasMarked = n.data.isMarked;
            return { ...n, data: { ...n.data, isMarked: !n.data.isMarked } };
          }
          return n;
        });
        return updatedNodes;
      });

      // 更新后端
      await updateMindMapNode(currentMindMapId, nodeId, {
        isMarked: !wasMarked,
      });

      message.success(wasMarked ? '已取消标记' : '已标记 ⭐');
    } catch (error: any) {
      console.error('Toggle mark error:', error);
      // API 失败，回滚 UI 状态
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isMarked: !n.data.isMarked } }
            : n
        )
      );
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 打开发散引导 Modal
  const handleDiverge = (nodeId: string) => {
    console.log('handleDiverge called:', nodeId);
    if (diverging) {
      message.warning('正在发散中，请稍候');
      return;
    }
    setDivergeNodeId(nodeId);
    setUserGuidance('');
    setDivergeModalOpen(true);
  };

  // 确认发散（执行实际的发散逻辑）
  const handleConfirmDiverge = async () => {
    const currentMindMapId = mindMapIdRef.current;
    const nodeId = divergeNodeId;

    console.log('handleConfirmDiverge called:', nodeId, 'mindMapId:', currentMindMapId);
    if (!currentMindMapId || !nodeId) {
      message.warning('参数错误');
      return;
    }

    try {
      setDiverging(true);
      message.loading('AI 正在发散创意...', 0);

      // 获取父节点当前位置
      console.log('🎯 Diverge - Looking for nodeId:', nodeId);
      const parentNode = nodes.find(n => n.id === nodeId);
      console.log('🎯 Diverge - Found parent node:', parentNode);
      const parentPosition = parentNode?.position;

      const response = await divergeNode(currentMindMapId, nodeId, {
        parentPosition,
        userGuidance: userGuidance.trim() || undefined
      });
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

      // 关闭 Modal
      setDivergeModalOpen(false);
      setUserGuidance('');
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
      // 获取父节点当前位置
      const parentNode = nodes.find(n => n.id === selectedParentId);
      const parentPosition = parentNode?.position;

      const response = await addManualNode(currentMindMapId, {
        parentId: selectedParentId,
        content: newNodeContent.trim(),
        parentPosition,
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

  // 获取所有子孙节点
  const getDescendants = useCallback((nodeId: string, currentEdges: Edge[]): string[] => {
    const children = currentEdges
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target);

    const descendants: string[] = [...children];
    children.forEach(childId => {
      descendants.push(...getDescendants(childId, currentEdges));
    });

    return descendants;
  }, []);

  // 更新节点位置
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 处理位置变化，同步移动子节点
      const positionChanges = changes.filter(
        (change): change is NodeChange & { type: 'position'; position: { x: number; y: number } } =>
          change.type === 'position' && change.position !== undefined
      );

      // 先处理非位置变化
      const nonPositionChanges = changes.filter(change => change.type !== 'position');
      if (nonPositionChanges.length > 0) {
        onNodesChange(nonPositionChanges);
      }

      // 如果有位置变化，需要同步更新子节点
      if (positionChanges.length > 0) {
        // 更新父节点和子节点的位置
        setNodes(currentNodes => {
          let updatedNodes = [...currentNodes];

          positionChanges.forEach((change: any) => {
            const movedNode = currentNodes.find(n => n.id === change.id);
            if (!movedNode || !change.position) return;

            // 计算位置差值
            const deltaX = change.position.x - movedNode.position.x;
            const deltaY = change.position.y - movedNode.position.y;

            // 如果位置没有变化，跳过
            if (deltaX === 0 && deltaY === 0) return;

            // 更新父节点位置
            updatedNodes = updatedNodes.map(node => {
              if (node.id === change.id) {
                return { ...node, position: change.position };
              }
              return node;
            });

            // 获取所有子孙节点并更新它们的位置
            const descendants = getDescendants(change.id, edges);
            updatedNodes = updatedNodes.map(node => {
              if (descendants.includes(node.id)) {
                return {
                  ...node,
                  position: {
                    x: node.position.x + deltaX,
                    y: node.position.y + deltaY,
                  },
                };
              }
              return node;
            });

            // 拖动结束时保存到后端
            if (!change.dragging) {
              const currentMindMapId = mindMapIdRef.current;
              if (currentMindMapId) {
                const nodesToUpdate = [change.id, ...descendants];

                // 批量更新后端（使用更新后的位置）
                nodesToUpdate.forEach(async (id) => {
                  const node = updatedNodes.find(n => n.id === id);
                  if (node) {
                    try {
                      await updateMindMapNode(currentMindMapId, id, {
                        position: node.position,
                      });
                    } catch (error) {
                      console.error(`Failed to update position for node ${id}:`, error);
                    }
                  }
                });
              }
            }
          });

          return updatedNodes;
        });
      }
    },
    [onNodesChange, edges, getDescendants]
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

      {/* AI 发散引导模态框 */}
      <Modal
        title="🤖 AI 创意发散"
        open={divergeModalOpen}
        onCancel={() => {
          setDivergeModalOpen(false);
          setUserGuidance('');
        }}
        onOk={handleConfirmDiverge}
        okText="开始发散 ✨"
        cancelText="取消"
        confirmLoading={diverging}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            📝 当前节点内容
          </div>
          <div
            style={{
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              color: '#666',
              lineHeight: '1.6',
            }}
          >
            {divergeNodeId ? nodes.find((n) => n.id === divergeNodeId)?.data.label : ''}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            💡 引导信息（可选）
          </div>
          <Input
            placeholder="例如：重点考虑小学生场景，结合任运IP..."
            value={userGuidance}
            onChange={(e) => setUserGuidance(e.target.value)}
            maxLength={100}
            showCount
          />
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            提示：留空则直接发散，填写后 AI 会结合你的引导生成更精准的方向
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default MindMapCanvas;
