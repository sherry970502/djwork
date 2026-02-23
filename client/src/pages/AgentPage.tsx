import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Spin,
  message,
  Empty
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ThunderboltOutlined
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
const { Text, Title } = Typography;

const AgentPage: React.FC = () => {
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

  const handleAnalysisComplete = async (_taskId: string, analysis: any) => {
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
