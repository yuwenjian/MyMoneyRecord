// DeepSeek API 配置
// 请将 API Key 存储在环境变量中，不要直接写在代码里
// 可以通过 .env 文件配置：VITE_DEEPSEEK_API_KEY=your_api_key_here

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

export { DEEPSEEK_API_KEY, DEEPSEEK_API_URL }

