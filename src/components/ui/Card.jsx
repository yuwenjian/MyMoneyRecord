import React from 'react'

/**
 * 统一卡片组件 - 精致奢华风格
 * @param {Object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.className - 额外的 CSS 类名
 * @param {boolean} props.shadow - 是否显示阴影（默认 true）
 * @param {boolean} props.padding - 是否显示内边距（默认 true）
 * @param {boolean} props.hover - 是否启用悬停效果（默认 true）
 */
export function Card({ children, className = '', shadow = true, padding = true, hover = true }) {
  return (
    <div
      className={`
        card-luxury w-full max-w-full overflow-hidden
        ${padding ? 'p-6 sm:p-8 lg:p-10' : ''}
        ${shadow ? 'shadow-dark-lg' : ''}
        ${hover ? '' : 'hover:transform-none hover:shadow-dark-lg'}
        ${className}
      `}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

/**
 * 渐变卡片组件 - 琥珀/金色主题
 * @param {Object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.fromColor - 渐变起始颜色
 * @param {string} props.toColor - 渐变结束颜色
 * @param {string} props.className - 额外的 CSS 类名
 */
export function GradientCard({ 
  children, 
  fromColor = 'from-amber-600', 
  toColor = 'to-gold-base',
  className = '' 
}) {
  return (
    <div
      className={`
        bg-gradient-to-br ${fromColor} ${toColor}
        rounded-3xl p-8 lg:p-10 text-white
        relative overflow-hidden
        transition-all duration-500 hover:scale-[1.02] hover:shadow-glow-gold
        border border-amber-400/20
        ${className}
      `}
    >
      {/* 装饰性光效 - 多层 */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-float"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-light/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
      
      {/* 纹理叠加 */}
      <div className="absolute inset-0 bg-noise opacity-10"></div>
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

