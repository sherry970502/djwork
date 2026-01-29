import React, { useEffect, useState } from 'react';
import {
  Card,
  Input,
  Button,
  List,
  Typography,
  message,
  Spin,
  Tag,
  Space,
  Divider,
  Empty
} from 'antd';
import {
  SendOutlined,
  LikeOutlined,
  DislikeOutlined,
  LikeFilled,
  DislikeFilled,
  HistoryOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { askKnowledge, getQAHistory, rateQA } from '../services/api';
import type { KnowledgeQA, Thought } from '../types';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const KnowledgePage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<KnowledgeQA | null>(null);
  const [history, setHistory] = useState<KnowledgeQA[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getQAHistory({ limit: 20 });
      setHistory(res.data);
    } catch {
      message.error('获取历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAsk = async () => {
    if (!question.trim()) {
      message.warning('请输入问题');
      return;
    }

    setLoading(true);
    setCurrentAnswer(null);
    try {
      const res = await askKnowledge(question.trim());
      setCurrentAnswer(res.data);
      setQuestion('');
      fetchHistory();
    } catch {
      message.error('提问失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (id: string, helpful: boolean) => {
    try {
      await rateQA(id, helpful);
      if (currentAnswer && currentAnswer._id === id) {
        setCurrentAnswer({ ...currentAnswer, helpful });
      }
      setHistory(prev =>
        prev.map(qa => (qa._id === id ? { ...qa, helpful } : qa))
      );
      message.success('感谢反馈');
    } catch {
      message.error('评价失败');
    }
  };

  const renderAnswer = (qa: KnowledgeQA) => (
    <Card
      style={{ marginTop: 16 }}
      actions={[
        <Button
          key="like"
          type="text"
          icon={qa.helpful === true ? <LikeFilled style={{ color: '#52c41a' }} /> : <LikeOutlined />}
          onClick={() => handleRate(qa._id, true)}
        >
          有帮助
        </Button>,
        <Button
          key="dislike"
          type="text"
          icon={qa.helpful === false ? <DislikeFilled style={{ color: '#f5222d' }} /> : <DislikeOutlined />}
          onClick={() => handleRate(qa._id, false)}
        >
          没帮助
        </Button>
      ]}
    >
      <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>
        {qa.answer}
      </Paragraph>

      {qa.relatedThoughts && qa.relatedThoughts.length > 0 && (
        <div>
          <Divider />
          <Text type="secondary">相关灵感知识库内容：</Text>
          <List
            size="small"
            dataSource={qa.relatedThoughts.slice(0, 5)}
            renderItem={(thought: Thought, index: number) => (
              <List.Item>
                <Space>
                  <Tag>[{index + 1}]</Tag>
                  <Text ellipsis style={{ maxWidth: 500 }}>
                    {thought.content}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          置信度: {(qa.confidence * 100).toFixed(0)}% · {dayjs(qa.createdAt).format('YYYY-MM-DD HH:mm')}
        </Text>
      </div>
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
          <QuestionCircleOutlined style={{ marginRight: 8 }} />
          知识库问答
        </Title>
        <Button
          icon={<HistoryOutlined />}
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? '隐藏历史' : '查看历史'}
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            基于 DJ 的灵感知识库内容回答问题。系统会自动检索相关的历史思考，并结合企业背景进行分析。
          </Text>
        </div>

        <TextArea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="请输入您想咨询的问题，例如：关于AI教育的战略方向有哪些思考？"
          rows={3}
          onPressEnter={e => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            onClick={handleAsk}
          >
            提问
          </Button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>正在检索知识库并生成回答...</Paragraph>
          </div>
        )}

        {currentAnswer && !loading && renderAnswer(currentAnswer)}
      </Card>

      {showHistory && (
        <Card title="历史问答" style={{ marginTop: 24 }}>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : history.length > 0 ? (
            <List
              dataSource={history}
              renderItem={qa => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>Q: {qa.question}</Text>
                      <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
                        {dayjs(qa.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      {qa.helpful === true && <Tag color="green" style={{ marginLeft: 8 }}>有帮助</Tag>}
                      {qa.helpful === false && <Tag color="red" style={{ marginLeft: 8 }}>没帮助</Tag>}
                    </div>
                    <Paragraph
                      ellipsis={{ rows: 2, expandable: true }}
                      style={{ marginBottom: 0 }}
                    >
                      A: {qa.answer}
                    </Paragraph>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无历史记录" />
          )}
        </Card>
      )}
    </div>
  );
};

export default KnowledgePage;
