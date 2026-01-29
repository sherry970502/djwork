# DJ 会议纪要智能处理系统

一个基于 AI 的会议纪要智能处理系统，支持会议纪要输入、AI 自动提取 DJ 的战略层面核心结论、按标签浏览管理、以及相似结论检测合并。

## 功能特性

- **会议纪要输入**: 支持文本粘贴和文件上传（PDF、Word、TXT）
- **AI 智能提取**: 使用 Claude API 自动提取 DJ 的战略层面核心结论（非执行层面的观点）
- **自动分类**: 根据预设标签自动分类思考内容
- **相似度检测**: 基于 TF-IDF + Embedding 的两阶段相似度检测
- **结论管理**: 支持按标签、日期筛选，标记重要，合并相似结论

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design + Vite
- **后端**: Node.js + Express + MongoDB
- **AI**: Claude API (claude-sonnet-4-20250514)
- **向量嵌入**: Voyage AI (可选)

## 快速开始

### 前置要求

- Node.js 18+
- MongoDB 6+
- Claude API Key

### 1. 安装依赖

```bash
# 后端
cd server
npm install

# 前端
cd ../client
npm install
```

### 2. 配置环境变量

编辑项目根目录的 `.env` 文件：

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/chairman-meeting
CLAUDE_API_KEY=your_claude_api_key_here
VOYAGE_API_KEY=your_voyage_api_key_here  # 可选
```

### 3. 启动 MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# 或使用 Docker
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### 4. 启动应用

```bash
# 启动后端 (端口 3001)
cd server
npm run dev

# 启动前端 (端口 3000)
cd client
npm run dev
```

访问 http://localhost:3000 即可使用。

## 项目结构

```
chairman-meeting-system/
├── server/                     # 后端
│   ├── app.js                  # Express 入口
│   ├── config/index.js         # 配置管理
│   ├── models/                 # Mongoose 模型
│   ├── controllers/            # 控制器
│   ├── services/               # 服务层 (AI, 文件解析, 相似度)
│   ├── routes/                 # API 路由
│   └── middlewares/            # 中间件
│
├── client/                     # 前端
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   ├── components/         # 通用组件
│   │   ├── services/api.ts     # API 服务
│   │   └── types/              # TypeScript 类型
│   └── package.json
│
└── .env                        # 环境变量配置
```

## API 端点

### 会议纪要
- `GET /api/meetings` - 获取会议列表
- `POST /api/meetings` - 创建会议（文本粘贴）
- `POST /api/meetings/upload` - 上传会议文件
- `GET /api/meetings/:id` - 获取会议详情
- `POST /api/meetings/:id/process` - 触发 AI 处理
- `DELETE /api/meetings/:id` - 删除会议

### 思考条目
- `GET /api/thoughts` - 获取思考列表（支持筛选）
- `GET /api/thoughts/:id` - 获取思考详情
- `PUT /api/thoughts/:id` - 更新思考
- `POST /api/thoughts/:id/important` - 切换重要状态
- `GET /api/thoughts/similar` - 获取待处理相似项
- `POST /api/thoughts/merge` - 合并思考
- `POST /api/thoughts/dismiss` - 忽略相似建议

### 标签
- `GET /api/tags` - 获取标签列表
- `POST /api/tags` - 创建标签
- `PUT /api/tags/:id` - 更新标签
- `DELETE /api/tags/:id` - 删除标签
- `GET /api/tags/stats` - 获取标签统计

## 预设标签

| 标签 | 说明 |
|-----|-----|
| education_core | 教育核心竞争力 |
| ai_technology | AI 技术 |
| product_strategy | 产品战略 |
| organization | 组织管理 |
| business_model | 商业模式 |
| market_insight | 市场洞察 |
| decision | 重要决策 |
| reflection | 反思复盘 |

## 使用流程

1. **上传会议纪要**: 在首页或会议页面上传/粘贴会议纪要
2. **触发 AI 处理**: 点击"处理"按钮，AI 自动提取 DJ 的战略层面核心结论
3. **浏览结论**: 在思考页面按标签、日期等筛选查看
4. **处理相似**: 在相似合并页面处理检测到的相似结论
5. **管理标签**: 在标签页面管理和自定义标签

## License

MIT
