import AV from 'leancloud-storage'

// LeanCloud 配置
// 优先使用环境变量，避免把错误的域名或密钥写死在代码里。
const APP_ID = import.meta.env.VITE_LEANCLOUD_APP_ID || 'NVdP17Z5V3ZhUGTFuVy8HXCv-gzGzoHsz'
const APP_KEY = import.meta.env.VITE_LEANCLOUD_APP_KEY || 'An5UQGOYrjGV3DOUq6vRCwZF'
const SERVER_URL = import.meta.env.VITE_LEANCLOUD_SERVER_URL || 'https://money.report.yuyipeng.top'

if (!APP_ID || !APP_KEY || !SERVER_URL) {
  throw new Error('LeanCloud 配置缺失，请检查 VITE_LEANCLOUD_APP_ID / VITE_LEANCLOUD_APP_KEY / VITE_LEANCLOUD_SERVER_URL')
}

// 初始化 LeanCloud
AV.init({
  appId: APP_ID,
  appKey: APP_KEY,
  serverURL: SERVER_URL
})

export const leancloudConfig = {
  appId: APP_ID,
  serverURL: SERVER_URL
}

export default AV
