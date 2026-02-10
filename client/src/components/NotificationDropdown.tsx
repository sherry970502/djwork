import { useState, useEffect } from 'react';
import { Badge, Dropdown, Button, List, Empty, Typography, Tag, Spin } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification
} from '../services/api';

const { Text } = Typography;

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // 获取通知列表
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications({ limit: 10 });
      setNotifications(response.data || []);
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取未读数量
  const fetchUnreadCount = async () => {
    try {
      const response = await getUnreadNotificationCount();
      setUnreadCount(response.data?.count || 0);
    } catch (error) {
      console.error('获取未读数量失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchUnreadCount();
    // 每分钟刷新一次未读数量
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // 打开 Dropdown 时加载通知列表
  const handleDropdownVisibleChange = (visible: boolean) => {
    setDropdownVisible(visible);
    if (visible) {
      fetchNotifications();
    }
  };

  // 点击通知
  const handleNotificationClick = async (notification: Notification) => {
    try {
      // 标记为已读
      if (!notification.isRead) {
        await markNotificationAsRead(notification._id);
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      // 跳转到相关页面
      if (notification.relatedLink) {
        navigate(notification.relatedLink);
      }

      // 关闭 Dropdown
      setDropdownVisible(false);
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 全部标记为已读
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      fetchNotifications();
    } catch (error) {
      console.error('批量标记失败:', error);
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#ff4d4f';
      case 'medium':
        return '#faad14';
      case 'low':
        return '#52c41a';
      default:
        return '#d9d9d9';
    }
  };

  // 获取优先级文本
  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return '';
    }
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString('zh-CN');
  };

  // Dropdown 内容
  const dropdownContent = (
    <div style={{ width: 360, maxHeight: 500, overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>📬 站内提醒</Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAllRead();
            }}
          >
            全部标为已读
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : notifications.length === 0 ? (
        <Empty
          description="暂无通知"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 40 }}
        />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              key={notification._id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: notification.isRead ? '#fff' : '#f6ffed',
                borderBottom: '1px solid #f0f0f0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = notification.isRead ? '#fafafa' : '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = notification.isRead ? '#fff' : '#f6ffed';
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: notification.isRead ? '#d9d9d9' : getPriorityColor(notification.priority),
                      marginRight: 8
                    }}
                  />
                  <Text strong style={{ fontSize: 14 }}>
                    {notification.title}
                  </Text>
                  {!notification.isRead && (
                    <Tag color="red" style={{ marginLeft: 'auto', fontSize: 12 }}>
                      {getPriorityText(notification.priority)}
                    </Tag>
                  )}
                </div>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 13,
                    display: 'block',
                    marginBottom: 4,
                    paddingLeft: 16
                  }}
                >
                  {notification.content}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, paddingLeft: 16 }}>
                  {formatTime(notification.createdAt)}
                </Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      open={dropdownVisible}
      onOpenChange={handleDropdownVisibleChange}
      placement="bottomRight"
    >
      <Badge count={unreadCount} offset={[-5, 5]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{ marginRight: 8 }}
        />
      </Badge>
    </Dropdown>
  );
}
