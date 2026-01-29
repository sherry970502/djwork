import React from 'react';
import { List, Empty, Spin } from 'antd';
import ThoughtCard from './ThoughtCard';
import type { Thought } from '../types';

interface ThoughtListProps {
  thoughts: Thought[];
  loading?: boolean;
  onToggleImportant?: (id: string) => void;
  onEdit?: (thought: Thought) => void;
  onDelete?: (id: string) => void;
  onViewMeeting?: (meetingId: string) => void;
  showMeeting?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

const ThoughtList: React.FC<ThoughtListProps> = ({
  thoughts,
  loading = false,
  onToggleImportant,
  onEdit,
  onDelete,
  onViewMeeting,
  showMeeting = true,
  pagination
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (thoughts.length === 0) {
    return <Empty description="暂无思考记录" />;
  }

  return (
    <List
      dataSource={thoughts}
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: pagination.onChange,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`
            }
          : false
      }
      renderItem={thought => (
        <ThoughtCard
          key={thought._id}
          thought={thought}
          onToggleImportant={onToggleImportant}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewMeeting={onViewMeeting}
          showMeeting={showMeeting}
        />
      )}
    />
  );
};

export default ThoughtList;
