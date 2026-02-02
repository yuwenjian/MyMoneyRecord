# 部署指南

## Vercel 部署

### 环境变量配置

在 Vercel 后台配置以下环境变量：

#### 必需的环境变量

1. **VITE_DEEPSEEK_API_KEY**
   - DeepSeek API Key，用于 AI 智能分析功能
   - 获取地址：[DeepSeek 平台](https://platform.deepseek.com/api_keys)

2. **VITE_LEANCLOUD_APP_ID**
   - LeanCloud 应用 ID，用于数据存储
   - 获取地址：[LeanCloud 控制台](https://console.leancloud.app/)

3. **VITE_LEANCLOUD_APP_KEY**
   - LeanCloud 应用 Key
   - 获取地址：[LeanCloud 控制台](https://console.leancloud.app/)

4. **VITE_LEANCLOUD_SERVER_URL**
   - LeanCloud 服务器地址
   - 示例：`https://your-app.lc-cn-n1-shared.com`

### 在 Vercel 中设置环境变量

1. 进入你的 Vercel 项目
2. 点击 **Settings** 标签
3. 在左侧菜单中选择 **Environment Variables**
4. 添加上述环境变量，每个变量分别添加
5. 确保选择适当的环境（Production、Preview、Development）
6. 点击 **Save** 保存

### 本地开发

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入你的 API Key 和配置：
   ```env
   VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here
   VITE_LEANCLOUD_APP_ID=your_app_id_here
   VITE_LEANCLOUD_APP_KEY=your_app_key_here
   VITE_LEANCLOUD_SERVER_URL=https://your-app.lc-cn-n1-shared.com
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

### 注意事项

- ⚠️ **不要将 `.env` 文件提交到 Git 仓库**（已在 `.gitignore` 中配置）
- 所有环境变量必须以 `VITE_` 开头才能在客户端访问
- 修改环境变量后，需要重新部署才能生效
- API Key 等敏感信息只存储在环境变量中，不会存储在本地 localStorage

### 获取 API Key

#### DeepSeek API Key
1. 访问 [DeepSeek 平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 [API Keys 页面](https://platform.deepseek.com/api_keys)
4. 创建新的 API Key
5. 复制 API Key 到环境变量中

#### LeanCloud 配置
1. 访问 [LeanCloud 控制台](https://console.leancloud.app/)
2. 创建应用
3. 在应用设置中找到 App ID 和 App Key
4. 在域名设置中获取 Server URL

## 其他部署平台

本项目基于 Vite 构建，支持部署到任何静态网站托管平台，如：

- Netlify
- GitHub Pages
- Cloudflare Pages
- Railway

部署到其他平台时，请参考各平台的文档配置环境变量。
