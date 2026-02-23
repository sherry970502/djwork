import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Spin,
  message,
  Tag,
  Divider,
  Row,
  Col,
  Empty,
  Progress
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ThunderboltOutlined,
  LinkOutlined
} from '@ant-design/icons';
import {
  sendAgentMessage,
  getAgentScenarios,
  getConversationHistory,
  saveConversation,
  clearConversationHistory
} from '../services/api';
import type { AgentMessage, QuickScenario } from '../services/api';
import AgentContentBlocks from '../components/AgentContentBlocks';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

const AgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Array<AgentMessage & { toolCalls?: any[]; blocks?: any[] }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<QuickScenario[]>([]);
  const [conversationId, setConversationId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载快捷场景和对话历史
  useEffect(() => {
    loadScenarios();
    loadConversationHistory();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadScenarios = async () => {
    try {
      const res = await getAgentScenarios();
      setScenarios(res.data);
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    }
  };

  const loadConversationHistory = async () => {
    try {
      const res = await getConversationHistory();
      setConversationId(res.data.conversationId);
      setMessages(res.data.messages || []);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  };

  const saveConversationHistory = async (newMessages: typeof messages) => {
    try {
      const res = await saveConversation({
        conversationId: conversationId || undefined,
        messages: newMessages
      });
      if (res.data?.conversationId) {
        setConversationId(res.data.conversationId);
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearConversationHistory();
      setMessages([]);
      setConversationId('');
      message.success('对话历史已清空');
    } catch (error: any) {
      message.error('清空失败: ' + (error.message || '未知错误'));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputValue.trim();
    if (!textToSend) return;

    const userMessage: AgentMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const res = await sendAgentMessage({
        message: textToSend,
        conversationHistory
      });

      const assistantMessage: AgentMessage & { toolCalls?: any[]; blocks?: any[] } = {
        role: 'assistant',
        content: res.data.reply,
        toolCalls: res.data.toolCalls,
        blocks: res.data.blocks, // 新增：保存内容块
        timestamp: new Date()
      };

      const newMessages = [...messages, userMessage, assistantMessage];
      setMessages(newMessages);

      // 保存对话历史
      await saveConversationHistory(newMessages);
    } catch (error: any) {
      message.error(error.message || '消息发送失败');
      console.error('Send message error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioClick = (scenario: QuickScenario) => {
    handleSend(scenario.prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAnalysisComplete = async (taskId: string, analysis: any) => {
    // 将分析结果添加到对话中
    const analysisMessage: AgentMessage & { toolCalls?: any[]; blocks?: any[] } = {
      role: 'assistant',
      content: `✅ 已完成任务分析\n\n${analysis.analysis || ''}`,
      timestamp: new Date()
    };

    const newMessages = [...messages, analysisMessage];
    setMessages(newMessages);
    await saveConversationHistory(newMessages);
  };

  const renderToolCallResult = (toolCall: any) => {
    const { toolName, result } = toolCall;

    // 渲染月度计划结果
    if (toolName === 'get_monthly_plan' && result.found) {
      return (
        <Card
          size="small"
          title={
            <Space>
              <span>📅 {result.year}年{result.month}月 工作计划</span>
              <Tag color="blue">{result.title}</Tag>
            </Space>
          }
          extra={
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => navigate('/monthly-plan')}
            >
              查看详情
            </Button>
          }
          style={{ marginTop: 12 }}
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Progress
                percent={Math.round(result.stats.progress)}
                strokeColor={{
                  '0%': '#667eea',
                  '100%': '#764ba2',
                }}
              />
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#667eea' }}>
                  {result.stats.totalTasks}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>总任务</Text>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                  {result.stats.completedTasks}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>已完成</Text>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                  {result.stats.inProgressTasks}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>进行中</Text>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
                  {result.stats.pendingTasks}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>未开始</Text>
              </div>
            </Col>
          </Row>

          {result.goals && result.goals.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text strong style={{ fontSize: 13 }}>月度目标：</Text>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {result.goals.map((goal: string, index: number) => (
                    <li key={index}>
                      <Text style={{ fontSize: 13 }}>{goal}</Text>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </Card>
      );
    }

    // 渲染工作复盘结果
    if (toolName === 'generate_work_review') {
      return (
        <Card
          size="small"
          title={`📊 ${result.period.year}年${result.period.month}月 工作复盘`}
          style={{ marginTop: 12 }}
        >
          {result.plan && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>计划完成情况：</Text>
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={Math.round(result.plan.progress || 0)}
                  status={result.plan.progress >= 80 ? 'success' : 'normal'}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已完成 {result.plan.completedTasks} / {result.plan.totalTasks} 个任务
                </Text>
              </div>
            </div>
          )}

          <Divider style={{ margin: '12px 0' }} />

          <div style={{ marginBottom: 16 }}>
            <Text strong>重要灵感：</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>共 {result.insights.total} 条</Text>
            {result.insights.items.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {result.insights.items.slice(0, 3).map((insight: any, index: number) => (
                  <div key={insight.id} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                    <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 13 }}>
                      {insight.content}
                    </Paragraph>
                    <Space size={4} style={{ marginTop: 4 }}>
                      {insight.tags.map((tag: string) => (
                        <Tag key={tag} color="blue" style={{ fontSize: 11 }}>{tag}</Tag>
                      ))}
                    </Space>
                  </div>
                ))}
                {result.insights.total > 3 && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate('/thoughts')}
                  >
                    查看全部 {result.insights.total} 条灵感
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <Text strong>会议记录：</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>共 {result.meetings.total} 场</Text>
            {result.meetings.items.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {result.meetings.items.slice(0, 3).map((meeting: any) => (
                  <div key={meeting.id} style={{ marginBottom: 6 }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      {meeting.title}
                    </Button>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      {dayjs(meeting.date).format('MM-DD')} · {meeting.thoughtCount} 条思考
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      );
    }

    // 渲染会议灵感结果
    if (toolName === 'extract_meeting_insights') {
      return (
        <Card
          size="small"
          title={`💡 会议灵感 (${result.total} 条)`}
          extra={
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => navigate('/thoughts')}
            >
              查看全部
            </Button>
          }
          style={{ marginTop: 12 }}
        >
          {result.recentThoughts.length > 0 ? (
            result.recentThoughts.map((thought: any) => (
              <div key={thought.id} style={{ marginBottom: 12, padding: 10, background: '#fafafa', borderRadius: 6 }}>
                <Paragraph style={{ margin: 0, marginBottom: 6, fontSize: 13 }}>
                  {thought.content}
                </Paragraph>
                <Space size={4}>
                  {thought.isImportant && (
                    <Tag color="gold" style={{ fontSize: 11 }}>重要</Tag>
                  )}
                  {thought.tags.map((tag: string) => (
                    <Tag key={tag} color="blue" style={{ fontSize: 11 }}>{tag}</Tag>
                  ))}
                </Space>
              </div>
            ))
          ) : (
            <Empty description="暂无灵感" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      );
    }

    // 渲染知识查询结果
    if (toolName === 'search_knowledge') {
      return (
        <Card
          size="small"
          title={`🔍 "${result.query}" 的搜索结果 (共 ${result.totalFound} 条)`}
          style={{ marginTop: 12 }}
        >
          {result.results.thoughts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}>灵感 ({result.results.thoughts.length})</Text>
              <div style={{ marginTop: 8 }}>
                {result.results.thoughts.slice(0, 3).map((thought: any) => (
                  <div key={thought.id} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                    <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 13 }}>
                      {thought.content}
                    </Paragraph>
                    <Space size={4} style={{ marginTop: 4 }}>
                      {thought.tags.map((tag: string) => (
                        <Tag key={tag} color="blue" style={{ fontSize: 11 }}>{tag}</Tag>
                      ))}
                    </Space>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.results.meetings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}>会议 ({result.results.meetings.length})</Text>
              <div style={{ marginTop: 8 }}>
                {result.results.meetings.map((meeting: any) => (
                  <div key={meeting.id} style={{ marginBottom: 6 }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      {meeting.title}
                    </Button>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      {dayjs(meeting.date).format('YYYY-MM-DD')}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.results.tags.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 13 }}>标签 ({result.results.tags.length})</Text>
              <div style={{ marginTop: 8 }}>
                <Space size={8} wrap>
                  {result.results.tags.map((tag: any) => (
                    <Tag
                      key={tag.id}
                      color="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/thoughts?tags=${tag.id}`)}
                    >
                      {tag.displayName} ({tag.thoughtCount})
                    </Tag>
                  ))}
                </Space>
              </div>
            </div>
          )}

          {result.totalFound === 0 && (
            <Empty description="未找到相关内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      );
    }

    // 默认渲染
    return (
      <Card size="small" style={{ marginTop: 12 }}>
        <pre style={{ margin: 0, fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </Card>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
            <RobotOutlined style={{ marginRight: 8, color: '#667eea' }} />
            AI 工作助手
          </Title>
          <Text type="secondary">通过对话方式，快速查询和管理你的工作事务</Text>
        </div>
        {messages.length > 0 && (
          <Button
            danger
            size="small"
            onClick={handleClearHistory}
            style={{ marginTop: 4 }}
          >
            清空历史
          </Button>
        )}
      </div>

      {/* Quick Scenarios - 紧凑显示 */}
      <div style={{ marginBottom: 12 }}>
        <Space size={8} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ThunderboltOutlined style={{ marginRight: 4 }} />
            快捷场景:
          </Text>
          {scenarios.map(scenario => (
            <Button
              key={scenario.id}
              size="small"
              onClick={() => handleScenarioClick(scenario)}
              style={{
                fontSize: 12,
                height: 28,
                padding: '0 12px',
                borderColor: '#d9d9d9'
              }}
            >
              <span style={{ marginRight: 4 }}>{scenario.icon}</span>
              {scenario.title}
            </Button>
          ))}
        </Space>
      </div>

      {/* Messages */}
      <Card
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: 16
        }}
        bodyStyle={{
          flex: 1,
          overflow: 'auto',
          padding: 16
        }}
      >
        {messages.length === 0 ? (
          <Empty
            description="开始对话，我会帮你处理工作事务"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 60 }}
          />
        ) : (
          <div>
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{ maxWidth: '80%' }}>
                  <Space size={8} align="start" style={{ width: '100%' }}>
                    {msg.role === 'assistant' && (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0
                        }}
                      >
                        <RobotOutlined />
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: msg.role === 'user'
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : '#f5f5f5',
                          color: msg.role === 'user' ? 'white' : '#333'
                        }}
                      >
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
                          {msg.content}
                        </div>
                      </div>

                      {/* 渲染内容块 */}
                      {msg.blocks && msg.blocks.length > 0 && (
                        <AgentContentBlocks
                          blocks={msg.blocks}
                          onAnalysisComplete={handleAnalysisComplete}
                        />
                      )}

                      <Text
                        type="secondary"
                        style={{
                          fontSize: 11,
                          marginTop: 4,
                          display: 'block',
                          textAlign: msg.role === 'user' ? 'right' : 'left'
                        }}
                      >
                        {msg.timestamp && dayjs(msg.timestamp).format('HH:mm')}
                      </Text>
                    </div>

                    {msg.role === 'user' && (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#1890ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          flexShrink: 0
                        }}
                      >
                        <UserOutlined />
                      </div>
                    )}
                  </Space>
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin tip="AI 正在思考..." />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </Card>

      {/* Input */}
      <Card bodyStyle={{ padding: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ fontSize: 14 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleSend()}
            loading={loading}
            disabled={!inputValue.trim()}
            style={{
              height: 'auto',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none'
            }}
          >
            发送
          </Button>
        </Space.Compact>
      </Card>
    </div>
  );
};

export default AgentPage;
