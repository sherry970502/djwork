import React, { useState } from 'react';
import { Card, List, Button, Tag, Space, Progress, message, Spin, Modal } from 'antd';
import { LinkOutlined, ThunderboltOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
import { Typography } from 'antd';

interface ContentBlock {
  type: string;
  [key: string]: any;
}

interface AgentContentBlocksProps {
  blocks: ContentBlock[];
  onAnalysisComplete?: (taskId: string, analysis: any) => void;
}

const AgentContentBlocks: React.FC<AgentContentBlocksProps> = ({ blocks, onAnalysisComplete }) => {
  const navigate = useNavigate();
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [analysisModal, setAnalysisModal] = useState<{
    visible: boolean;
    title: string;
    content: any;
  }>({
    visible: false,
    title: '',
    content: null
  });

  const handleAction = async (action: any, itemId: string, itemTitle?: string) => {
    if (action.type === 'view' && action.link) {
      navigate(action.link);
      return;
    }

    if (action.type === 'analyze' && action.endpoint) {
      const actionKey = `${itemId}-analyze`;
      setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

      try {
        console.log('Calling analysis endpoint:', action.endpoint);
        const response = await axios.post(action.endpoint);
        console.log('Analysis response:', response.data);

        const analysisData = response.data.data;
        console.log('Analysis data:', analysisData);

        // 显示分析结果弹窗
        setAnalysisModal({
          visible: true,
          title: `「${itemTitle || '任务'}」的 AI 分析`,
          content: analysisData
        });

        // 通知父组件分析完成
        if (onAnalysisComplete) {
          onAnalysisComplete(itemId, analysisData);
        }

        message.success('AI 分析完成！');
      } catch (error: any) {
        console.error('Analysis error:', error);
        message.error(error.response?.data?.message || 'AI 分析失败');
      } finally {
        setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
      }
    }
  };

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'task_list':
        return (
          <Card
            key={index}
            size="small"
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#1890ff' }} />
                <span>{block.title}</span>
              </Space>
            }
            style={{ marginTop: 12 }}
          >
            {block.description && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                {block.description}
              </Text>
            )}
            <List
              size="small"
              dataSource={block.items}
              renderItem={(item: any) => {
                const actionKey = `${item.id}-analyze`;
                return (
                  <List.Item
                    style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
                    actions={item.actions?.map((action: any, idx: number) => (
                      <Button
                        key={idx}
                        type={action.type === 'analyze' ? 'primary' : 'link'}
                        size="small"
                        icon={action.type === 'analyze' ? <ThunderboltOutlined /> : <EyeOutlined />}
                        onClick={() => handleAction(action, item.id, item.title)}
                        loading={loadingActions[actionKey]}
                      >
                        {action.label}
                      </Button>
                    ))}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 14 }}>{item.title}</Text>
                          {item.priority === 'high' && (
                            <Tag color="red" style={{ fontSize: 11 }}>高优先级</Tag>
                          )}
                          {item.status === 'pending' && (
                            <Tag color="orange" style={{ fontSize: 11 }}>待分析</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        );

      case 'thought_list':
        return (
          <Card
            key={index}
            size="small"
            title={
              <Space>
                <span>💡</span>
                <span>{block.title}</span>
              </Space>
            }
            style={{ marginTop: 12 }}
          >
            {block.description && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                {block.description}
              </Text>
            )}
            <List
              size="small"
              dataSource={block.items}
              renderItem={(item: any) => (
                <List.Item
                  style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
                  actions={item.actions?.map((action: any, idx: number) => (
                    <Button
                      key={idx}
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => handleAction(action, item.id)}
                    >
                      {action.label}
                    </Button>
                  ))}
                >
                  <div style={{ width: '100%' }}>
                    <Paragraph
                      style={{ margin: 0, marginBottom: 8, fontSize: 13 }}
                      ellipsis={{ rows: 2 }}
                    >
                      {item.content}
                    </Paragraph>
                    <Space size={4} wrap>
                      {item.tags?.map((tag: any, idx: number) => (
                        <Tag key={idx} color={tag.color} style={{ fontSize: 11 }}>
                          {tag.name}
                        </Tag>
                      ))}
                    </Space>
                    {item.meeting && (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          来自会议：{item.meeting.title} · {dayjs(item.meeting.date).format('MM-DD')}
                        </Text>
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          </Card>
        );

      case 'status_overview':
        return (
          <Card
            key={index}
            size="small"
            title={
              <Space>
                <span>📊</span>
                <span>{block.title}</span>
              </Space>
            }
            style={{ marginTop: 12 }}
          >
            {block.data.plan && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>月度计划进度</Text>
                <Progress
                  percent={block.data.plan.progress}
                  strokeColor={{ '0%': '#667eea', '100%': '#764ba2' }}
                  style={{ marginTop: 8 }}
                />
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                      {block.data.plan.completed}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>已完成</Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                      {block.data.plan.inProgress}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>进行中</Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#faad14' }}>
                      {block.data.plan.pending}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>待开始</Text>
                  </div>
                </div>
              </div>
            )}

            {block.data.tasks && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>组织事务池</Text>
                <div style={{ marginTop: 8 }}>
                  <Text>待处理：</Text>
                  <Text strong style={{ fontSize: 18, color: '#1890ff', marginLeft: 8 }}>
                    {block.data.tasks.pending}
                  </Text>
                  <Text type="secondary"> / {block.data.tasks.total}</Text>
                </div>
              </div>
            )}

            {block.actions && block.actions.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {block.actions.map((action: any, idx: number) => (
                  <Button
                    key={idx}
                    type="link"
                    icon={<LinkOutlined />}
                    onClick={() => handleAction(action, 'overview')}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        );

      default:
        return null;
    }
  };

  const renderAnalysisContent = (content: any) => {
    if (!content) {
      return <Text type="secondary">暂无分析内容</Text>;
    }

    console.log('Rendering analysis content:', content);

    // 支持多种数据格式
    const analysis = content.analysis || content.task?.analysis?.analysis || '';
    const suggestions = content.suggestions || content.task?.analysis?.suggestions || [];
    const nextSteps = content.nextSteps || content.task?.analysis?.nextSteps || [];

    return (
      <div>
        {analysis && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 15 }}>📊 AI 分析结果</Text>
            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 14 }}>
              {analysis}
            </Paragraph>
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 15 }}>💡 建议</Text>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              {suggestions.map((suggestion: string, idx: number) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 14 }}>{suggestion}</Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nextSteps && nextSteps.length > 0 && (
          <div>
            <Text strong style={{ fontSize: 15 }}>🎯 下一步行动</Text>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              {nextSteps.map((step: string, idx: number) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 14 }}>{step}</Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!analysis && suggestions.length === 0 && nextSteps.length === 0 && (
          <Text type="secondary">未找到分析结果，请稍后重试</Text>
        )}
      </div>
    );
  };

  return (
    <div>
      {blocks.map((block, index) => renderBlock(block, index))}

      {/* AI 分析结果弹窗 */}
      <Modal
        title={analysisModal.title}
        open={analysisModal.visible}
        onCancel={() => setAnalysisModal({ ...analysisModal, visible: false })}
        footer={[
          <Button key="close" onClick={() => setAnalysisModal({ ...analysisModal, visible: false })}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {renderAnalysisContent(analysisModal.content)}
      </Modal>
    </div>
  );
};

export default AgentContentBlocks;
