import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// 确保 LeanCloud 在应用启动前初始化
import './config/leancloud'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

