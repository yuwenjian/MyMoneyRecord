import React from 'react'

/**
 * 统一卡片组件
 * @param {Object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.className - 额外的 CSS 类名
 * @param {boolean} props.shadow - 是否显示阴影（默认 true）
 * @param {boolean} props.padding - 是否显示内边距（默认 true）
 * @param {boolean} props.hover - 是否启用悬停效果（默认 false）
 */
export function Card({ children, className = '', shadow = true, padding = true, hover = false }) {
  return (
    <div
      className={`
        bg-white rounded-2xl w-full max-w-full overflow-hidden
        ${padding ? 'p-5 sm:p-6 lg:p-8' : ''}
        ${shadow ? 'shadow-soft' : ''}
        ${hover ? 'card-hover' : ''}
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </div>
  )
}

/**
 * 渐变卡片组件
 * @param {Object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.fromColor - 渐变起始颜色（默认 'from-primary-600'）
 * @param {string} props.toColor - 渐变结束颜色（默认 'to-primary-700'）
 * @param {string} props.className - 额外的 CSS 类名
 */
export function GradientCard({ 
  children, 
  fromColor = 'from-primary-600', 
  toColor = 'to-primary-700',
  className = '' 
}) {
  return (
    <div
      className={`
        bg-gradient-to-br ${fromColor} ${toColor}
        rounded-3xl p-6 lg:p-8 text-white shadow-large
        relative overflow-hidden
        transition-all duration-300 hover:shadow-xl hover:scale-[1.02]
        ${className}
      `}
    >
      {/* 装饰性光效 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

