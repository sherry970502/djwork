import React, { useEffect, useState } from 'react';
import {
  Card,
  Empty,
  Spin,
  message,
  Typography,
  Badge,
  Alert
} from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import { getSimilarThoughts } from '../services/api';
import type { Thought } from '../types';
import ThoughtCard from '../components/ThoughtCard';
import SimilarityPanel from '../components/SimilarityPanel';

const { Title, Paragraph } = Typography;

const SimilarityPage: React.FC = () => {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSimilarThoughts = async () => {
    setLoading(true);
    try {
      const res = await getSimilarThoughts();
      setThoughts(res.data);
    } catch {
      message.error('获取相似思考失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimilarThoughts();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

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
          <BranchesOutlined style={{ marginRight: 8 }} />
          相似思考合并
          <Badge
            count={thoughts.length}
            style={{ marginLeft: 12, backgroundColor: thoughts.length > 0 ? '#f5222d' : '#52c41a' }}
          />
        </Title>
      </div>

      <Alert
        message="相似度检测说明"
        description={
          <Paragraph style={{ marginBottom: 0 }}>
            系统会自动检测语义相似的思考，您可以选择合并相似内容或忽略。
            合并后，被合并的思考将被标记并从列表中移除，主思考将保留所有标签。
          </Paragraph>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {thoughts.length === 0 ? (
        <Card>
          <Empty
            description={
              <span>
                没有待处理的相似思考
                <br />
                <span style={{ color: '#999', fontSize: 13 }}>
                  系统会在处理会议纪要时自动检测相似内容
                </span>
              </span>
            }
          />
        </Card>
      ) : (
        <div>
          {thoughts.map(thought => (
            <Card key={thought._id} style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginTop: 0 }}>主思考</Title>
              <ThoughtCard
                thought={thought}
                showMeeting={true}
              />
              <SimilarityPanel
                thought={thought}
                onUpdate={fetchSimilarThoughts}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimilarityPage;
