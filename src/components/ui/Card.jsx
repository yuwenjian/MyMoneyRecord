import React from 'react'

/**
 * 统一卡片组件
 * @param {Object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.className - 额外的 CSS 类名
 * @param {boolean} props.shadow - 是否显示阴影（默认 true）
 * @param {boolean} props.padding - 是否显示内边距（默认 true）
 */
export function Card({ children, className = '', shadow = true, padding = true }) {
  return (
    <div
      className={`
        bg-white rounded-xl
        ${padding ? 'p-6' : ''}
        ${shadow ? 'shadow-sm' : ''}
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
 * @param {string} props.fromColor - 渐变起始颜色（默认 'from-blue-600'）
 * @param {string} props.toColor - 渐变结束颜色（默认 'to-blue-700'）
 * @param {string} props.className - 额外的 CSS 类名
 */
export function GradientCard({ 
  children, 
  fromColor = 'from-blue-600', 
  toColor = 'to-blue-700',
  className = '' 
}) {
  return (
    <div
      className={`
        bg-gradient-to-br ${fromColor} ${toColor}
        rounded-2xl p-6 lg:p-8 text-white shadow-lg
        ${className}
      `}
    >
      {children}
    </div>
  )
}

