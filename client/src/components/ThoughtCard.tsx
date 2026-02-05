import React from 'react';
import { Card, Tag, Space, Button, Tooltip, Typography, Popconfirm } from 'antd';
import {
  StarOutlined,
  StarFilled,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  QuestionCircleOutlined,
  TrophyOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import type { Thought, MeetingMinutes } from '../types';

const { Paragraph, Text } = Typography;

// 内容类型配置
const contentTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  TODO: { label: '待办', color: 'red', icon: <CheckCircleOutlined /> },
  CONCLUSION: { label: '结论', color: 'green', icon: <TrophyOutlined /> },
  DECISION: { label: '决策', color: 'blue', icon: <CheckCircleOutlined /> },
  QUESTION: { label: '问题', color: 'orange', icon: <QuestionCircleOutlined /> },
  IDEA: { label: '想法', color: 'purple', icon: <BulbOutlined /> },
  OBSERVATION: { label: '观察', color: 'cyan', icon: <EyeOutlined /> }
};

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
  const navigate = useNavigate();
  const meeting = thought.meetingMinutesId as MeetingMinutes;

  // 调试：查看数据
  const quote = thought.originalQuote || thought.originalSegment;
  console.log('ThoughtCard data:', {
    hasOriginalQuote: !!thought.originalQuote,
    originalQuoteLength: thought.originalQuote?.length || 0,
    hasOriginalSegment: !!thought.originalSegment,
    originalSegmentLength: thought.originalSegment?.length || 0,
    extractionVersion: thought.extractionVersion,
    quote: quote?.substring(0, 50) + '...',
    canClick: !!(typeof meeting === 'object' ? meeting?._id : meeting) && !!quote
  });

  const handleQuoteClick = () => {
    console.log('🔵 原文引用被点击');

    const quote = thought.originalQuote || thought.originalSegment;
    if (!quote) {
      console.log('❌ 没有 quote');
      return;
    }

    // meeting 可能是对象或字符串ID
    const meetingId = typeof meeting === 'object' ? meeting._id : meeting;
    console.log('会议信息:', {
      meetingType: typeof meeting,
      meetingId: meetingId,
      quote: quote.substring(0, 50) + '...'
    });

    if (meetingId) {
      const url = `/meetings/${meetingId}?highlight=${encodeURIComponent(quote)}`;
      console.log('🚀 准备跳转到:', url);
      navigate(url);
    } else {
      console.log('❌ 没有 meetingId');
    }
  };

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
          {/* 内容类型标签 */}
          {thought.contentType && contentTypeConfig[thought.contentType] && (
            <Tag
              color={contentTypeConfig[thought.contentType].color}
              icon={contentTypeConfig[thought.contentType].icon}
            >
              {contentTypeConfig[thought.contentType].label}
            </Tag>
          )}

          {/* 提取版本标签（V2新提取） */}
          {thought.extractionVersion === 2 && (
            <Tag color="success">V2</Tag>
          )}

          {/* 业务标签 */}
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

      {/* 优先显示新的 originalQuote，如果没有则显示旧的 originalSegment */}
      {(thought.originalQuote || thought.originalSegment) && (
        <div
          onClick={handleQuoteClick}
          style={{
            background: '#f5f5f5',
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 12,
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e6f7ff';
            e.currentTarget.style.borderLeft = '3px solid #1890ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f5f5f5';
            e.currentTarget.style.borderLeft = 'none';
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            📄 原文引用（点击查看完整上下文）：
          </Text>
          <Paragraph
            type="secondary"
            style={{ marginBottom: 0, fontSize: 13 }}
            ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
          >
            {thought.originalQuote || thought.originalSegment}
          </Paragraph>
        </div>
      )}

      {/* 上下文补充 */}
      {thought.context && (
        <div
          style={{
            background: '#e6f7ff',
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 12,
            borderLeft: '3px solid #1890ff'
          }}
        >
          <Text style={{ fontSize: 12, color: '#1890ff' }}>
            💡 上下文：
          </Text>
          <Paragraph
            style={{ marginBottom: 0, fontSize: 13, color: '#096dd9' }}
          >
            {thought.context}
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
