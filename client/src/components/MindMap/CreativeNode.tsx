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

  // 根据层级和类型生成渐变色
  const getNodeStyle = () => {
    const isRoot = data.level === 0;
    const isMarked = data.isMarked;
    const isAI = data.isAIGenerated;

    // 标记节点 - 金色光晕
    if (isMarked) {
      return {
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        boxShadow: '0 0 20px rgba(255, 215, 0, 0.6), 0 8px 24px rgba(0,0,0,0.15)',
        border: '2px solid #FFD700',
      };
    }

    // 根节点 - 强烈的渐变
    if (isRoot) {
      return {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
        border: '2px solid rgba(255,255,255,0.3)',
      };
    }

    // AI 生成节点 - 蓝色科技感
    if (isAI) {
      return {
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        boxShadow: selected
          ? '0 0 0 3px rgba(79, 172, 254, 0.3), 0 8px 24px rgba(0,0,0,0.15)'
          : '0 4px 12px rgba(79, 172, 254, 0.25)',
        border: '2px solid rgba(255,255,255,0.4)',
      };
    }

    // 普通节点 - 根据层级渐变
    const colors = [
      ['#a8edea', '#fed6e3'], // 层级1 - 青粉
      ['#ffecd2', '#fcb69f'], // 层级2 - 橙粉
      ['#e0c3fc', '#8ec5fc'], // 层级3 - 紫蓝
      ['#fbc2eb', '#a6c1ee'], // 层级4 - 粉蓝
      ['#fdcbf1', '#e6dee9'], // 层级5+ - 粉灰
    ];

    const colorIndex = Math.min(data.level - 1, colors.length - 1);
    const [color1, color2] = colors[colorIndex];

    return {
      background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
      boxShadow: selected
        ? '0 0 0 3px rgba(138, 43, 226, 0.2), 0 8px 24px rgba(0,0,0,0.15)'
        : '0 4px 12px rgba(0,0,0,0.1)',
      border: '2px solid rgba(255,255,255,0.5)',
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
          borderRadius: isRoot ? '20px' : '12px',
          minWidth: isRoot ? '200px' : '150px',
          maxWidth: '300px',
          color: '#fff',
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
              background: '#fff',
              width: '10px',
              height: '10px',
              border: '2px solid rgba(255,255,255,0.8)',
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
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
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
            background: '#fff',
            width: '10px',
            height: '10px',
            border: '2px solid rgba(255,255,255,0.8)',
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
