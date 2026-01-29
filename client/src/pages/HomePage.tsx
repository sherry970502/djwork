import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Tag,
  List,
  Typography,
  Spin,
  message,
  Button,
  Space,
  Avatar
} from 'antd';
import {
  FileTextOutlined,
  BulbOutlined,
  StarOutlined,
  ClockCircleOutlined,
  BranchesOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  FireOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { getStats, getThoughts, getMeetings } from '../services/api';
import type { DashboardStats, Thought, MeetingMinutes } from '../types';
import MeetingUploader from '../components/MeetingUploader';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentThoughts, setRecentThoughts] = useState<Thought[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, thoughtsRes, meetingsRes] = await Promise.all([
        getStats(),
        getThoughts({ limit: 5, isImportant: 'true' }),
        getMeetings({ limit: 5 })
      ]);
      setStats(statsRes.data);
      setRecentThoughts(thoughtsRes.data);
      setRecentMeetings(meetingsRes.data);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading || !stats) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statCards = [
    {
      title: '会议纪要',
      value: stats.totalMeetings,
      icon: <FileTextOutlined style={{ fontSize: 28 }} />,
      color: '#667eea',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      path: '/meetings'
    },
    {
      title: '灵感总数',
      value: stats.totalThoughts,
      icon: <BulbOutlined style={{ fontSize: 28 }} />,
      color: '#4facfe',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      path: '/thoughts'
    },
    {
      title: '重要灵感',
      value: stats.importantThoughts,
      icon: <StarOutlined style={{ fontSize: 28 }} />,
      color: '#fa709a',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      path: '/thoughts?important=true'
    },
    {
      title: '待处理相似',
      value: stats.pendingSimilar,
      icon: <BranchesOutlined style={{ fontSize: 28 }} />,
      color: stats.pendingSimilar > 0 ? '#f5576c' : '#38ef7d',
      gradient: stats.pendingSimilar > 0
        ? 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)'
        : 'linear-gradient(135deg, #38ef7d 0%, #11998e 100%)',
      path: '/similarity'
    }
  ];

  const taskCards = [
    {
      title: '待分析任务',
      value: stats.pendingTasks || 0,
      icon: <ThunderboltOutlined style={{ fontSize: 28 }} />,
      color: (stats.pendingTasks || 0) > 0 ? '#f5576c' : '#38ef7d',
      gradient: (stats.pendingTasks || 0) > 0
        ? 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)'
        : 'linear-gradient(135deg, #38ef7d 0%, #11998e 100%)',
      path: '/tasks'
    },
    {
      title: '已完成分析',
      value: stats.completedTasks || 0,
      icon: <TrophyOutlined style={{ fontSize: 28 }} />,
      color: '#38ef7d',
      gradient: 'linear-gradient(135deg, #38ef7d 0%, #11998e 100%)',
      path: '/tasks'
    }
  ];

  return (
    <div className="fade-in-up">
      {/* Header Section */}
      <div style={{
        marginBottom: 32,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <Title level={3} style={{ margin: 0, marginBottom: 8 }} className="page-title">
            工作仪表盘
          </Title>
          <Text type="secondary">欢迎回来，今天是 {dayjs().format('YYYY年MM月DD日 dddd')}</Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setUploaderOpen(true)}
          style={{ height: 44, paddingLeft: 24, paddingRight: 24 }}
        >
          新建会议纪要
        </Button>
      </div>

      {/* Statistics Cards - 灵感知识库 */}
      <div className="section-title">灵感知识库</div>
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => navigate(card.path)}
              style={{ height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{card.title}</Text>
                  <div style={{
                    fontSize: 36,
                    fontWeight: 700,
                    marginTop: 8,
                    background: card.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {card.value}
                  </div>
                </div>
                <Avatar
                  size={56}
                  style={{
                    background: card.gradient,
                    boxShadow: `0 4px 14px ${card.color}40`
                  }}
                  icon={card.icon}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Statistics Cards - 战略决策 */}
      <div className="section-title">战略决策</div>
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        {taskCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => navigate(card.path)}
              style={{ height: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{card.title}</Text>
                  <div style={{
                    fontSize: 36,
                    fontWeight: 700,
                    marginTop: 8,
                    background: card.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {card.value}
                  </div>
                </div>
                <Avatar
                  size={56}
                  style={{
                    background: card.gradient,
                    boxShadow: `0 4px 14px ${card.color}40`
                  }}
                  icon={card.icon}
                />
              </div>
            </Card>
          </Col>
        ))}
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="stat-card"
            hoverable
            onClick={() => navigate('/insights')}
            style={{
              height: '100%',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80 }}>
              <Space direction="vertical" align="center">
                <RocketOutlined style={{ fontSize: 32, color: '#667eea' }} />
                <Text strong style={{ color: '#667eea' }}>查看月度洞察</Text>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Content Cards */}
      <Row gutter={[20, 20]}>
        {/* Top Tags */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: '#fa709a' }} />
                <span>热门标签</span>
              </Space>
            }
            extra={<Button type="link" onClick={() => navigate('/tags')}>查看全部</Button>}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {stats.topTags.map(tag => (
                <Tag
                  key={tag._id}
                  color={tag.color}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 14px',
                    fontSize: 13,
                    borderRadius: 20
                  }}
                  onClick={() => navigate(`/thoughts?tags=${tag._id}`)}
                >
                  {tag.displayName} ({tag.thoughtCount})
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        {/* Recent Important Thoughts */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <StarOutlined style={{ color: '#faad14' }} className="important-badge" />
                <span>重要思考</span>
              </Space>
            }
            extra={<Button type="link" onClick={() => navigate('/thoughts?important=true')}>查看全部</Button>}
          >
            {recentThoughts.length > 0 ? (
              <List
                size="small"
                dataSource={recentThoughts}
                renderItem={thought => (
                  <List.Item style={{ border: 'none', padding: '8px 0' }}>
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 0, color: '#444' }}
                    >
                      {thought.content}
                    </Paragraph>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无重要思考
              </div>
            )}
          </Card>
        </Col>

        {/* Recent Meetings */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#4facfe' }} />
                <span>最近会议</span>
              </Space>
            }
            extra={<Button type="link" onClick={() => navigate('/meetings')}>查看全部</Button>}
          >
            <List
              size="small"
              dataSource={recentMeetings}
              renderItem={meeting => (
                <List.Item
                  style={{ cursor: 'pointer', border: 'none', padding: '10px 0' }}
                  onClick={() => navigate(`/meetings/${meeting._id}`)}
                >
                  <List.Item.Meta
                    title={
                      <Text strong style={{ fontSize: 14 }}>{meeting.title}</Text>
                    }
                    description={
                      <Space size={8}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(meeting.meetingDate).format('MM-DD')}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {meeting.thoughtCount} 条思考
                        </Text>
                        {meeting.processStatus === 'pending' && (
                          <Tag color="orange" style={{ fontSize: 11 }}>待处理</Tag>
                        )}
                        {meeting.processStatus === 'processing' && (
                          <Tag color="blue" style={{ fontSize: 11 }}>处理中</Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <MeetingUploader
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default HomePage;
