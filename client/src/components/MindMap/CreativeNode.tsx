import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Dropdown, Input, message } from 'antd';
import {
  StarFilled,
  StarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

interface CreativeNodeData {
  label: string;
  isMarked: boolean;
  isAIGenerated: boolean;
  level: number;
  divergenceType?: 'horizontal' | 'vertical' | 'root';
  onToggleMark?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onEdit?: (nodeId: string, content: string) => void;
  onAddChild?: (nodeId: string) => void;
  onDiverge?: (nodeId: string) => void;
}

const CreativeNode: React.FC<NodeProps<CreativeNodeData>> = ({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);

  // 简洁高级的配色方案
  const getNodeStyle = () => {
    const isRoot = data.level === 0;
    const isMarked = data.isMarked;
    const isAI = data.isAIGenerated;

    // 标记节点 - 金色强调
    if (isMarked) {
      return {
        background: '#FFFFFF',
        boxShadow: '0 0 0 3px #FFD700, 0 4px 16px rgba(255, 215, 0, 0.3)',
        border: '2px solid #FFD700',
        color: '#1a1a1a',
      };
    }

    // 根节点 - 深色背景，白色文字
    if (isRoot) {
      return {
        background: '#1a1a1a',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        border: '2px solid #333333',
        color: '#FFFFFF',
      };
    }

    // AI 生成节点 - 浅灰背景，细边框
    if (isAI) {
      return {
        background: '#F8F9FA',
        boxShadow: selected
          ? '0 0 0 2px #1a1a1a, 0 4px 16px rgba(0, 0, 0, 0.1)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        border: '1.5px solid #E0E0E0',
        color: '#1a1a1a',
      };
    }

    // 普通节点 - 白色背景，简洁边框
    return {
      background: '#FFFFFF',
      boxShadow: selected
        ? '0 0 0 2px #666666, 0 4px 16px rgba(0, 0, 0, 0.1)'
        : '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1.5px solid #D0D0D0',
      color: '#1a1a1a',
    };
  };

  const handleSave = () => {
    if (editValue.trim() && editValue !== data.label) {
      data.onEdit?.(id, editValue.trim());
      message.success('已更新');
    }
    setIsEditing(false);
  };

  const menuItems = [
    {
      key: 'mark',
      icon: data.isMarked ? <StarFilled /> : <StarOutlined />,
      label: data.isMarked ? '取消标记' : '⭐ 标记创意',
      onClick: () => data.onToggleMark?.(id),
    },
    {
      key: 'diverge',
      icon: <ThunderboltOutlined />,
      label: '🤖 AI发散',
      onClick: () => data.onDiverge?.(id),
    },
    {
      key: 'add',
      icon: <PlusOutlined />,
      label: '➕ 手动添加',
      onClick: () => data.onAddChild?.(id),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '✏️ 编辑内容',
      onClick: () => setIsEditing(true),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '🗑️ 删除',
      danger: true,
      onClick: () => data.onDelete?.(id),
    },
  ];

  const nodeStyle = getNodeStyle();
  const isRoot = data.level === 0;

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div
        className="creative-node"
        style={{
          ...nodeStyle,
          padding: isRoot ? '20px 30px' : '12px 20px',
          borderRadius: isRoot ? '16px' : '10px',
          minWidth: isRoot ? '200px' : '150px',
          maxWidth: '300px',
          fontWeight: data.isMarked ? 700 : isRoot ? 600 : 500,
          fontSize: isRoot ? '18px' : data.isMarked ? '15px' : '14px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          userSelect: 'none',
        }}
        onDoubleClick={() => !isRoot && setIsEditing(true)}
      >
        {/* 连接点 */}
        {!isRoot && (
          <Handle
            type="target"
            position={Position.Top}
            style={{
              background: '#FFFFFF',
              width: '8px',
              height: '8px',
              border: '2px solid #666666',
            }}
          />
        )}

        {/* AI 生成标识 */}
        {data.isAIGenerated && !data.isMarked && (
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            🤖
          </div>
        )}

        {/* 标记星标 */}
        {data.isMarked && (
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              fontSize: '24px',
              animation: 'pulse 2s infinite',
            }}
          >
            ⭐
          </div>
        )}

        {/* 内容 */}
        {isEditing ? (
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onPressEnter={handleSave}
            onBlur={handleSave}
            style={{
              textAlign: 'center',
              fontWeight: 'inherit',
              fontSize: 'inherit',
            }}
          />
        ) : (
          <div
            style={{
              wordBreak: 'break-word',
            }}
          >
            {data.label}
          </div>
        )}

        {/* 底部连接点 */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: '#FFFFFF',
            width: '8px',
            height: '8px',
            border: '2px solid #666666',
          }}
        />

        {/* CSS 动画 */}
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
          }

          .creative-node:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 12px 28px rgba(0,0,0,0.2) !important;
          }

          .creative-node:active {
            transform: scale(0.98);
          }
        `}</style>
      </div>
    </Dropdown>
  );
};

export default memo(CreativeNode);
