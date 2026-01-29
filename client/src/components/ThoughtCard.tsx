import React from 'react';
import { Card, Tag, Space, Button, Tooltip, Typography, Popconfirm } from 'antd';
import {
  StarOutlined,
  StarFilled,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Thought, MeetingMinutes } from '../types';

const { Paragraph, Text } = Typography;

interface ThoughtCardProps {
  thought: Thought;
  onToggleImportant?: (id: string) => void;
  onEdit?: (thought: Thought) => void;
  onDelete?: (id: string) => void;
  onViewMeeting?: (meetingId: string) => void;
  showMeeting?: boolean;
}

const ThoughtCard: React.FC<ThoughtCardProps> = ({
  thought,
  onToggleImportant,
  onEdit,
  onDelete,
  onViewMeeting,
  showMeeting = true
}) => {
  const meeting = thought.meetingMinutesId as MeetingMinutes;

  return (
    <Card
      className="thought-card"
      size="small"
      style={{
        marginBottom: 16,
        borderLeft: thought.isImportant ? '4px solid #f5222d' : undefined
      }}
      actions={[
        <Tooltip title={thought.isImportant ? '取消重要' : '标记重要'} key="important">
          <Button
            type="text"
            icon={
              thought.isImportant ? (
                <StarFilled style={{ color: '#faad14' }} />
              ) : (
                <StarOutlined />
              )
            }
            onClick={() => onToggleImportant?.(thought._id)}
          />
        </Tooltip>,
        <Tooltip title="编辑" key="edit">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onEdit?.(thought)}
          />
        </Tooltip>,
        <Popconfirm
          title="确定删除此思考吗？"
          onConfirm={() => onDelete?.(thought._id)}
          okText="确定"
          cancelText="取消"
          key="delete"
        >
          <Tooltip title="删除">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      ]}
    >
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          {thought.tags.map(tag => (
            <Tag key={tag._id} color={tag.color}>
              {tag.displayName}
            </Tag>
          ))}
          {thought.isImportant && (
            <Tag color="red" className="important-badge">
              重要
            </Tag>
          )}
        </Space>
      </div>

      <Paragraph
        style={{ marginBottom: 12, fontSize: 15 }}
        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
      >
        {thought.content}
      </Paragraph>

      {thought.originalSegment && (
        <div
          style={{
            background: '#f5f5f5',
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 12
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            原文引用：
          </Text>
          <Paragraph
            type="secondary"
            style={{ marginBottom: 0, fontSize: 13 }}
            ellipsis={{ rows: 2 }}
          >
            {thought.originalSegment}
          </Paragraph>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          置信度: {(thought.confidence * 100).toFixed(0)}%
        </Text>
        {showMeeting && meeting && typeof meeting === 'object' && (
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => onViewMeeting?.(meeting._id)}
          >
            {meeting.title} ({dayjs(meeting.meetingDate).format('YYYY-MM-DD')})
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ThoughtCard;
