// DeepSeek API 配置
// 从环境变量读取 API Key
// 在 Vercel 部署时，请在 Vercel 后台设置 VITE_DEEPSEEK_API_KEY 环境变量

function getDeepSeekAPIKey() {
  return import.meta.env.VITE_DEEPSEEK_API_KEY || ''
}

const DEEPSEEK_API_KEY = getDeepSeekAPIKey()
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

export { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, getDeepSeekAPIKey }

