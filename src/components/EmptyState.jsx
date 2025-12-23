import React from 'react'
import { FiInbox, FiTrendingUp, FiBarChart2 } from 'react-icons/fi'
import '../styles/EmptyState.css'

// 空状态组件
export function EmptyState({ type = 'default', message, icon, action }) {
  const getDefaultConfig = () => {
    switch (type) {
      case 'chart':
        return {
          icon: <FiBarChart2 />,
          title: '暂无图表数据',
          message: '请先添加一些投资记录，然后返回查看统计图表'
        }
      case 'history':
        return {
          icon: <FiInbox />,
          title: '暂无历史记录',
          message: '开始记录您的投资数据，追踪您的收益情况'
        }
      case 'statistics':
        return {
          icon: <FiTrendingUp />,
          title: '暂无统计数据',
          message: '添加投资记录后，这里将显示详细的统计分析'
        }
      default:
        return {
          icon: <FiInbox />,
          title: message || '暂无数据',
          message: '开始添加数据吧'
        }
    }
  }

  const config = {
    icon: icon || getDefaultConfig().icon,
    title: message || getDefaultConfig().title,
    message: getDefaultConfig().message
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{config.icon}</div>
      <h3 className="empty-state-title">{config.title}</h3>
      <p className="empty-state-message">{config.message}</p>
      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}
    </div>
  )
}

