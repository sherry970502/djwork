import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Button } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  BulbOutlined,
  TagsOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  ExperimentOutlined,
  CalendarOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import HomePage from './pages/HomePage';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import MeetingsPage from './pages/MeetingsPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import ThoughtsPage from './pages/ThoughtsPage';
import TagsPage from './pages/TagsPage';
import SimilarityPage from './pages/SimilarityPage';
import TasksPage from './pages/TasksPage';
import KnowledgePage from './pages/KnowledgePage';
import InsightsPage from './pages/InsightsPage';
import PersonalDesignsPage from './pages/PersonalDesignsPage';
import CreativeMindMapPage from './pages/CreativeMindMapPage';
import LoginPage from './pages/LoginPage';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('dj_authenticated') === 'true';
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('dj_authenticated');
    setIsAuthenticated(false);
  };

  // 如果未登录，显示登录页
  if (!isAuthenticated) {
    return (
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#667eea',
            borderRadius: 8,
          }
        }}
      >
        <LoginPage onLogin={handleLogin} />
      </ConfigProvider>
    );
  }

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">首页</Link>
    },
    {
      key: '/monthly-plan',
      icon: <CalendarOutlined />,
      label: <Link to="/monthly-plan">DJ 工作月度计划</Link>
    },
    {
      key: 'knowledge-group',
      icon: <BulbOutlined />,
      label: '灵感知识库',
      children: [
        {
          key: '/meetings',
          icon: <FileTextOutlined />,
          label: <Link to="/meetings">会议纪要</Link>
        },
        {
          key: '/thoughts',
          icon: <BulbOutlined />,
          label: <Link to="/thoughts">灵感浏览</Link>
        },
        {
          key: '/similarity',
          icon: <BranchesOutlined />,
          label: <Link to="/similarity">相似合并</Link>
        },
        {
          key: '/tags',
          icon: <TagsOutlined />,
          label: <Link to="/tags">标签管理</Link>
        }
      ]
    },
    {
      key: 'task-group',
      icon: <ThunderboltOutlined />,
      label: '战略决策',
      children: [
        {
          key: '/tasks',
          icon: <ThunderboltOutlined />,
          label: <Link to="/tasks">组织事务池</Link>
        },
        {
          key: '/knowledge',
          icon: <QuestionCircleOutlined />,
          label: <Link to="/knowledge">知识问答</Link>
        },
        {
          key: '/insights',
          icon: <RocketOutlined />,
          label: <Link to="/insights">月度洞察</Link>
        }
      ]
    },
    {
      key: 'design-group',
      icon: <ExperimentOutlined />,
      label: 'DJ 个人设计',
      children: [
        {
          key: '/designs',
          icon: <FileTextOutlined />,
          label: <Link to="/designs">设计列表</Link>
        },
        {
          key: '/designs/mindmap',
          icon: <ThunderboltOutlined />,
          label: <Link to="/designs/mindmap">创意发散</Link>
        }
      ]
    }
  ];

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/monthly-plan')) return '/monthly-plan';
    if (path.startsWith('/meetings')) return '/meetings';
    if (path.startsWith('/thoughts')) return '/thoughts';
    if (path.startsWith('/tags')) return '/tags';
    if (path.startsWith('/similarity')) return '/similarity';
    if (path.startsWith('/tasks')) return '/tasks';
    if (path.startsWith('/knowledge')) return '/knowledge';
    if (path.startsWith('/insights')) return '/insights';
    if (path === '/designs/mindmap') return '/designs/mindmap';
    if (path.startsWith('/designs')) return '/designs';
    return '/';
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (['/meetings', '/thoughts', '/similarity', '/tags'].some(p => path.startsWith(p))) {
      return ['knowledge-group'];
    }
    if (['/tasks', '/knowledge', '/insights'].some(p => path.startsWith(p))) {
      return ['task-group'];
    }
    if (path.startsWith('/designs')) {
      return ['design-group'];
    }
    return [];
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#667eea',
          borderRadius: 8,
          colorBgContainer: '#ffffff',
        },
        components: {
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
          }
        }
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          width={240}
          className="modern-sider"
          breakpoint="lg"
          collapsedWidth="0"
        >
          <div className="logo-container">
            <span className="logo-text">DJ 工作事务系统</span>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            defaultOpenKeys={getOpenKeys()}
            items={menuItems}
          />
        </Sider>
        <Layout>
          <Header className="modern-header" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="header-title" style={{ margin: 0 }}>
              DJ 工作事务处理系统
            </h2>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ color: 'inherit' }}
            >
              退出登录
            </Button>
          </Header>
          <Content className="modern-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/monthly-plan" element={<MonthlyPlanPage />} />
              <Route path="/meetings" element={<MeetingsPage />} />
              <Route path="/meetings/:id" element={<MeetingDetailPage />} />
              <Route path="/thoughts" element={<ThoughtsPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/similarity" element={<SimilarityPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/designs" element={<PersonalDesignsPage />} />
              <Route path="/designs/mindmap" element={<CreativeMindMapPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
