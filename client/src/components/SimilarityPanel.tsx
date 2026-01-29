import React, { useState } from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Space,
  Typography,
  Progress,
  Modal,
  Input,
  message,
  Divider,
  Empty
} from 'antd';
import {
  MergeCellsOutlined,
  CloseOutlined,
  CheckOutlined
} from '@ant-design/icons';
import type { Thought } from '../types';
import { mergeThoughts, dismissSimilar } from '../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SimilarityPanelProps {
  thought: Thought;
  onUpdate: () => void;
}

const SimilarityPanel: React.FC<SimilarityPanelProps> = ({
  thought,
  onUpdate
}) => {
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedContent, setMergedContent] = useState('');
  const [loading, setLoading] = useState(false);

  const pendingSimilar = thought.similarThoughts.filter(
    st => st.status === 'pending'
  );

  if (pendingSimilar.length === 0) {
    return null;
  }

  const handleDismiss = async (similarThoughtId: string) => {
    try {
      await dismissSimilar({
        thoughtId: thought._id,
        similarThoughtId
      });
      message.success('已忽略');
      onUpdate();
    } catch {
      message.error('操作失败');
    }
  };

  const openMergeModal = () => {
    setSelectedIds(pendingSimilar.map(st => {
      const stThought = st.thoughtId as Thought;
      return stThought._id;
    }));
    // Combine all content for editing
    const contents = [
      thought.content,
      ...pendingSimilar.map(st => {
        const stThought = st.thoughtId as Thought;
        return stThought.content;
      })
    ];
    setMergedContent(contents.join('\n\n---\n\n'));
    setMergeModalOpen(true);
  };

  const handleMerge = async () => {
    if (selectedIds.length === 0) {
      message.warning('请选择要合并的思考');
      return;
    }

    setLoading(true);
    try {
      await mergeThoughts({
        primaryId: thought._id,
        mergeIds: selectedIds,
        mergedContent: mergedContent.trim()
      });
      message.success('合并成功');
      setMergeModalOpen(false);
      onUpdate();
    } catch {
      message.error('合并失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <MergeCellsOutlined />
            <span>相似思考 ({pendingSimilar.length})</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<MergeCellsOutlined />}
            onClick={openMergeModal}
          >
            合并处理
          </Button>
        }
        style={{ marginTop: 16, background: '#fafafa' }}
      >
        <List
          size="small"
          dataSource={pendingSimilar}
          renderItem={item => {
            const similarThought = item.thoughtId as Thought;
            if (!similarThought || typeof similarThought === 'string') {
              return null;
            }

            return (
              <List.Item
                actions={[
                  <Button
                    key="dismiss"
                    type="text"
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => handleDismiss(similarThought._id)}
                  >
                    忽略
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Progress
                        type="circle"
                        percent={Math.round(item.similarity * 100)}
                        size={30}
                        strokeColor={{
                          '0%': '#108ee9',
                          '100%': '#87d068'
                        }}
                      />
                      <Space wrap size={4}>
                        {similarThought.tags?.map(tag => (
                          <Tag key={tag._id} color={tag.color} style={{ margin: 0 }}>
                            {tag.displayName}
                          </Tag>
                        ))}
                      </Space>
                    </Space>
                  }
                  description={
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 0, marginTop: 8 }}
                    >
                      {similarThought.content}
                    </Paragraph>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>

      <Modal
        title="合并相似思考"
        open={mergeModalOpen}
        onCancel={() => setMergeModalOpen(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setMergeModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="merge"
            type="primary"
            loading={loading}
            icon={<CheckOutlined />}
            onClick={handleMerge}
          >
            确认合并
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>主思考:</Text>
          <Card size="small" style={{ marginTop: 8 }}>
            <Space wrap>
              {thought.tags.map(tag => (
                <Tag key={tag._id} color={tag.color}>
                  {tag.displayName}
                </Tag>
              ))}
            </Space>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {thought.content}
            </Paragraph>
          </Card>
        </div>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Text strong>选择要合并的思考:</Text>
          {pendingSimilar.length > 0 ? (
            <List
              size="small"
              dataSource={pendingSimilar}
              renderItem={item => {
                const similarThought = item.thoughtId as Thought;
                if (!similarThought || typeof similarThought === 'string') {
                  return null;
                }
                const isSelected = selectedIds.includes(similarThought._id);

                return (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? '#e6f7ff' : undefined,
                      padding: '8px 12px',
                      borderRadius: 4,
                      marginTop: 8
                    }}
                    onClick={() => toggleSelect(similarThought._id)}
                  >
                    <Space>
                      <CheckOutlined
                        style={{
                          color: isSelected ? '#1890ff' : '#d9d9d9'
                        }}
                      />
                      <Text>{similarThought.content}</Text>
                      <Tag>{(item.similarity * 100).toFixed(0)}%</Tag>
                    </Space>
                  </List.Item>
                );
              }}
            />
          ) : (
            <Empty description="没有待合并的思考" />
          )}
        </div>

        <Divider />

        <div>
          <Text strong>合并后的内容（可编辑）:</Text>
          <TextArea
            rows={6}
            value={mergedContent}
            onChange={e => setMergedContent(e.target.value)}
            style={{ marginTop: 8 }}
            placeholder="编辑合并后的思考内容..."
          />
        </div>
      </Modal>
    </>
  );
};

export default SimilarityPanel;
