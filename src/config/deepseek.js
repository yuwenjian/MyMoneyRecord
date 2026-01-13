// DeepSeek API 配置
// 优先从 localStorage 读取（用户设置），其次从环境变量读取
// 用户可以在设置页面配置 API Key

function getDeepSeekAPIKey() {
  // 优先从 localStorage 读取用户设置的 API Key
  const userApiKey = localStorage.getItem('deepseek_api_key')
  if (userApiKey && userApiKey.trim()) {
    return userApiKey.trim()
  }
  // 如果没有用户设置，则从环境变量读取
  return import.meta.env.VITE_DEEPSEEK_API_KEY || ''
}

const DEEPSEEK_API_KEY = getDeepSeekAPIKey()
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

export { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, getDeepSeekAPIKey }

