import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  List,
  Typography,
  message,
  Spin,
  Tag,
  Space,
  DatePicker,
  Empty,
  Collapse,
  Badge
} from 'antd';
import {
  BulbOutlined,
  SyncOutlined,
  CheckOutlined,
  CloseOutlined,
  RocketOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  generateMonthlyInsight,
  getMonthlyInsight,
  getMonthlyInsights,
  updateTopicStatus
} from '../services/api';
import type { MonthlyInsight, SuggestedTopic } from '../types';

const { Title, Paragraph, Text } = Typography;

const categoryMap: Record<string, { color: string; text: string }> = {
  business: { color: 'blue', text: '业务/产品类' },
  organization: { color: 'purple', text: '组织/管理类' },
  strategy: { color: 'gold', text: '战略/资本类' },
  brand: { color: 'green', text: '品牌/生态类' }
};

const priorityMap: Record<string, { color: string; text: string }> = {
  high: { color: 'red', text: '高优先级' },
  medium: { color: 'orange', text: '中优先级' },
  low: { color: 'default', text: '低优先级' }
};

const InsightsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [insight, setInsight] = useState<MonthlyInsight | null>(null);
  const [allInsights, setAllInsights] = useState<MonthlyInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchInsight = async (month: string) => {
    setLoading(true);
    try {
      const res = await getMonthlyInsight(month);
      setInsight(res.data);
    } catch {
      setInsight(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllInsights = async () => {
    try {
      const res = await getMonthlyInsights();
      setAllInsights(res.data);
    } catch {
      console.error('Failed to fetch insights');
    }
  };

  useEffect(() => {
    fetchInsight(selectedMonth);
    fetchAllInsights();
  }, [selectedMonth]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateMonthlyInsight(selectedMonth);
      setInsight(res.data);
      fetchAllInsights();
      message.success('洞察生成成功');
    } catch {
      message.error('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleTopicStatus = async (topicId: string, status: 'accepted' | 'dismissed') => {
    try {
      const res = await updateTopicStatus(selectedMonth, topicId, status);
      setInsight(res.data);
      message.success(status === 'accepted' ? '已采纳' : '已忽略');
    } catch {
      message.error('操作失败');
    }
  };

  const renderTopic = (topic: SuggestedTopic) => (
    <Card
      key={topic._id}
      size="small"
      style={{
        marginBottom: 16,
        borderLeft: topic.priority === 'high' ? '4px solid #f5222d' : undefined
      }}
      actions={
        topic.status === 'suggested'
          ? [
              <Button
                key="accept"
                type="text"
                icon={<CheckOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => handleTopicStatus(topic._id, 'accepted')}
              >
                采纳
              </Button>,
              <Button
                key="dismiss"
                type="text"
                icon={<CloseOutlined />}
                danger
                onClick={() => handleTopicStatus(topic._id, 'dismissed')}
              >
                忽略
              </Button>
            ]
          : undefined
      }
    >
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Tag color={categoryMap[topic.category]?.color || 'default'}>
            {categoryMap[topic.category]?.text || topic.category}
          </Tag>
          <Tag color={priorityMap[topic.priority]?.color}>
            {priorityMap[topic.priority]?.text}
          </Tag>
          {topic.status === 'accepted' && <Tag color="green">已采纳</Tag>}
          {topic.status === 'dismissed' && <Tag color="default">已忽略</Tag>}
        </Space>
      </div>
      <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {topic.title}
      </Title>
      <Paragraph style={{ marginBottom: 8 }}>{topic.description}</Paragraph>
      <Text type="secondary" style={{ fontSize: 13 }}>
        推荐理由：{topic.reasoning}
      </Text>
    </Card>
  );

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          <RocketOutlined style={{ marginRight: 8 }} />
          月度洞察
        </Title>
        <Space>
          <DatePicker
            picker="month"
            value={dayjs(selectedMonth)}
            onChange={date => {
              if (date) {
                setSelectedMonth(date.format('YYYY-MM'));
              }
            }}
          />
          <Button
            type="primary"
            icon={<SyncOutlined spin={generating} />}
            loading={generating}
            onClick={handleGenerate}
          >
            {insight ? '重新生成' : '生成洞察'}
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      ) : insight ? (
        <div>
          {/* Summaries */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <Card title="本月思考总结">
              <Paragraph>{insight.thoughtsSummary || '暂无总结'}</Paragraph>
              <Text type="secondary">
                本月灵感数量：{insight.recentThoughts?.length || 0}
              </Text>
            </Card>
            <Card title="待处理任务分析">
              <Paragraph>{insight.tasksSummary || '暂无分析'}</Paragraph>
              <Text type="secondary">
                待处理任务数量：{insight.pendingTasks?.length || 0}
              </Text>
            </Card>
          </div>

          {/* Suggested Topics */}
          <Card
            title={
              <Space>
                <BulbOutlined />
                <span>推荐议题</span>
                <Badge
                  count={insight.suggestedTopics?.filter(t => t.status === 'suggested').length || 0}
                  style={{ backgroundColor: '#1890ff' }}
                />
              </Space>
            }
          >
            {insight.suggestedTopics && insight.suggestedTopics.length > 0 ? (
              <div>
                {insight.suggestedTopics
                  .filter(t => t.status === 'suggested')
                  .map(topic => renderTopic(topic))}

                {insight.suggestedTopics.filter(t => t.status !== 'suggested').length > 0 && (
                  <Collapse
                    items={[
                      {
                        key: 'processed',
                        label: `已处理的议题 (${insight.suggestedTopics.filter(t => t.status !== 'suggested').length})`,
                        children: insight.suggestedTopics
                          .filter(t => t.status !== 'suggested')
                          .map(topic => renderTopic(topic))
                      }
                    ]}
                  />
                )}
              </div>
            ) : (
              <Empty description="暂无推荐议题" />
            )}
          </Card>

          {/* Recent Thoughts */}
          {insight.recentThoughts && insight.recentThoughts.length > 0 && (
            <Card title="本月灵感记录" style={{ marginTop: 24 }}>
              <List
                size="small"
                dataSource={insight.recentThoughts.slice(0, 10)}
                renderItem={thought => (
                  <List.Item>
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                      {thought.content}
                    </Paragraph>
                  </List.Item>
                )}
              />
              {insight.recentThoughts.length > 10 && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Text type="secondary">还有 {insight.recentThoughts.length - 10} 条灵感...</Text>
                </div>
              )}
            </Card>
          )}

          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              生成时间：{dayjs(insight.generatedAt).format('YYYY-MM-DD HH:mm')}
            </Text>
          </div>
        </div>
      ) : (
        <Card>
          <Empty description={`${selectedMonth} 暂无洞察数据`}>
            <Button type="primary" onClick={handleGenerate} loading={generating}>
              立即生成
            </Button>
          </Empty>
        </Card>
      )}

      {/* Historical Insights */}
      {allInsights.length > 0 && (
        <Card title="历史洞察" style={{ marginTop: 24 }}>
          <List
            size="small"
            dataSource={allInsights}
            renderItem={item => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedMonth(item.month)}
              >
                <Space>
                  <Tag color={item.month === selectedMonth ? 'blue' : 'default'}>
                    {item.month}
                  </Tag>
                  <Text>推荐议题 {item.suggestedTopics?.length || 0} 个</Text>
                  <Text type="secondary">
                    灵感 {item.recentThoughts?.length || 0} 条
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default InsightsPage;
