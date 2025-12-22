import AV from 'leancloud-storage'

// LeanCloud 配置
const APP_ID = 'NVdP17Z5V3ZhUGTFuVy8HXCv-gzGzoHsz'
const APP_KEY = 'An5UQGOYrjGV3DOUq6vRCwZF'
const SERVER_URL = 'https://photo.yichu.online'

// 初始化 LeanCloud
AV.init({
  appId: APP_ID,
  appKey: APP_KEY,
  serverURL: SERVER_URL
})

export default AV

