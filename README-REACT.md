# 投资收益记录 - React H5 应用

这是一个使用 React 框架构建的投资收益记录 H5 应用。

## 技术栈

- React 18
- React Router 6
- Vite
- Chart.js (图表)
- Flatpickr (日期选择器)

## 安装依赖

```bash
npm install
```

## 开发

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

## 构建

```bash
npm run build
```

构建产物将输出到 `dist` 目录

## 项目结构

```
MyMoneyrecord/
├── src/
│   ├── pages/           # 页面组件
│   │   ├── RecordPage.jsx      # 记录页面
│   │   └── StatisticsPage.jsx # 统计页面
│   ├── utils/           # 工具函数
│   │   ├── storage.js         # 数据存储
│   │   └── calculations.js    # 计算函数
│   ├── styles/          # 样式文件
│   │   ├── RecordPage.css
│   │   └── StatisticsPage.css
│   ├── App.jsx          # 主应用组件
│   ├── main.jsx         # 入口文件
│   └── index.css        # 全局样式
├── style.css            # 共享样式
├── package.json
├── vite.config.js
└── index-react.html     # React 版本入口 HTML
```

## 功能特性

- ✅ 记录每日投资数据（股票/基金）
- ✅ 支持加减仓操作
- ✅ 自动计算盈亏
- ✅ 统计分析页面
- ✅ 趋势对比图表
- ✅ 历史记录查看
- ✅ 响应式设计（PC 和移动端）

## 数据存储

所有数据存储在浏览器的 localStorage 中，键名：
- `investment_records`: 投资记录
- `investment_adjustments`: 加减仓记录

## 注意事项

- 原版 HTML/JS 文件仍然保留，React 版本使用新的入口文件 `index-react.html`
- 样式文件 `style.css` 被 React 版本共享使用
- 数据存储格式与原版兼容

