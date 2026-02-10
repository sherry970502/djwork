import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Select, Space, Typography, Spin, message, Empty, Divider } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, ClearOutlined } from '@ant-design/icons';
import { getExperts, consultExpert, type Expert, type ExpertConsultation } from '../services/api';
import ReactMarkdown from 'react-markdown';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isComplete?: boolean;
}

export default function ExpertConsultantPage() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingExperts, setLoadingExperts] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // 加载专家列表
  useEffect(() => {
    loadExperts();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadExperts = async () => {
    try {
      setLoadingExperts(true);
      const response = await getExperts();
      setExperts(response.data);
      if (response.data.length > 0) {
        setSelectedExpert(response.data[0].id);
      }
    } catch (error: any) {
      message.error('加载专家列表失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingExperts(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleConsult = async () => {
    if (!question.trim()) {
      message.warning('请输入问题');
      return;
    }

    if (!selectedExpert) {
      message.warning('请选择专家');
      return;
    }

    const currentQuestion = question.trim();
    setQuestion('');

    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      content: currentQuestion,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      setLoading(true);

      // 准备上下文（最近4轮对话）
      const context = messages.slice(-8).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await consultExpert(selectedExpert, currentQuestion, context);

      // 添加专家回复
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date(response.data.timestamp),
        isComplete: response.data.isComplete
      };
      setMessages(prev => [...prev, assistantMessage]);

      // 如果回答不完整，给出提示
      if (!response.data.isComplete) {
        message.warning('AI 回答可能不完整，已尽可能获取完整内容');
      }

    } catch (error: any) {
      message.error('咨询失败: ' + (error.response?.data?.message || error.message));
      // 移除用户消息
      setMessages(prev => prev.slice(0, -1));
      // 恢复问题
      setQuestion(currentQuestion);
    } finally {
      setLoading(false);
      // 聚焦输入框
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    message.success('对话历史已清空');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConsult();
    }
  };

  const currentExpert = experts.find(e => e.id === selectedExpert);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          🧠 专家智囊团
        </Title>
        <Paragraph type="secondary">
          基于不同专家的思维模型，为您提供多角度的战略分析和决策建议
        </Paragraph>
      </div>

      {/* 专家选择 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space align="center" size="large" style={{ width: '100%' }}>
          <Text strong>选择专家:</Text>
          {loadingExperts ? (
            <Spin size="small" />
          ) : (
            <Select
              value={selectedExpert}
              onChange={setSelectedExpert}
              style={{ width: 280 }}
              size="large"
            >
              {experts.map(expert => (
                <Select.Option key={expert.id} value={expert.id}>
                  <Space>
                    <span style={{ fontSize: '20px' }}>{expert.avatar}</span>
                    <span>{expert.name}</span>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {expert.nameEn}
                    </Text>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          )}
          {currentExpert && (
            <Text type="secondary" style={{ flex: 1 }}>
              {currentExpert.description}
            </Text>
          )}
          {messages.length > 0 && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClearHistory}
              danger
              type="text"
            >
              清空历史
            </Button>
          )}
        </Space>
      </Card>

      {/* 对话区域 */}
      <Card
        style={{
          marginBottom: '16px',
          height: '60vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          backgroundColor: '#fafafa'
        }}
      >
        {messages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" align="center">
                <Text type="secondary">还没有对话记录</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  向专家提出您的问题，获得深度分析和建议
                </Text>
              </Space>
            }
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%'
            }}
          />
        ) : (
          <div>
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start'
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px',
                    flexShrink: 0,
                    marginLeft: msg.role === 'user' ? '12px' : 0,
                    marginRight: msg.role === 'user' ? 0 : '12px'
                  }}
                >
                  {msg.role === 'user' ? <UserOutlined /> : currentExpert?.avatar}
                </div>
                <div
                  style={{
                    flex: 1,
                    maxWidth: '80%'
                  }}
                >
                  <Card
                    size="small"
                    style={{
                      backgroundColor: msg.role === 'user' ? '#e6f7ff' : 'white',
                      border: msg.role === 'user' ? '1px solid #91d5ff' : '1px solid #d9d9d9'
                    }}
                    bodyStyle={{ padding: '12px 16px' }}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.isComplete === false && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #d9d9d9' }}>
                            <Text type="warning" style={{ fontSize: '12px' }}>
                              ⚠️ 回答可能不完整（受模型上下文限制）
                            </Text>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Text>{msg.content}</Text>
                    )}
                  </Card>
                  <div style={{ marginTop: '4px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </Card>

      {/* 输入区域 */}
      <Card>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            ref={inputRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`向 ${currentExpert?.name || '专家'} 提问...（Shift + Enter 换行，Enter 发送）`}
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={loading || !selectedExpert}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={loading ? <Spin size="small" /> : <SendOutlined />}
            onClick={handleConsult}
            disabled={loading || !question.trim() || !selectedExpert}
            size="large"
            style={{ height: 'auto' }}
          >
            {loading ? '思考中...' : '发送'}
          </Button>
        </Space.Compact>
      </Card>

      {/* Markdown 样式 */}
      <style>{`
        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4 {
          margin-top: 16px;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .markdown-content h1 {
          font-size: 20px;
        }
        .markdown-content h2 {
          font-size: 18px;
        }
        .markdown-content h3 {
          font-size: 16px;
        }
        .markdown-content h4 {
          font-size: 14px;
        }
        .markdown-content p {
          margin-bottom: 12px;
          line-height: 1.6;
        }
        .markdown-content ul,
        .markdown-content ol {
          margin-left: 20px;
          margin-bottom: 12px;
        }
        .markdown-content li {
          margin-bottom: 4px;
        }
        .markdown-content code {
          background-color: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
        }
        .markdown-content pre {
          background-color: #f5f5f5;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          margin-bottom: 12px;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .markdown-content blockquote {
          border-left: 4px solid #d9d9d9;
          padding-left: 12px;
          margin: 12px 0;
          color: #666;
        }
        .markdown-content strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
