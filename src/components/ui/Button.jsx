import React from 'react'

/**
 * 统一按钮组件
 * @param {Object} props
 * @param {React.ReactNode} props.children - 按钮内容
 * @param {string} props.variant - 按钮变体：'primary' | 'secondary' | 'danger' | 'ghost'
 * @param {string} props.size - 按钮大小：'sm' | 'md' | 'lg'（默认 'md'）
 * @param {string} props.className - 额外的 CSS 类名
 * @param {boolean} props.fullWidth - 是否全宽（默认 false）
 * @param {boolean} props.disabled - 是否禁用
 * @param {Function} props.onClick - 点击事件
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const baseClasses = 'font-sans font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-dark-bg active:scale-95'
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-amber-500 to-gold-base text-dark-bg hover:from-amber-400 hover:to-amber-500 focus:ring-amber-500 shadow-glow-amber hover:shadow-glow-gold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-glow-amber',
    secondary: 'bg-dark-elevated border-2 border-dark-border text-gray-200 hover:bg-dark-surface hover:border-amber-500/30 hover:text-amber-400 focus:ring-amber-500 shadow-dark-lg hover:shadow-dark-xl',
    danger: 'bg-gradient-to-r from-danger-600 to-danger-500 text-white hover:from-danger-500 hover:to-danger-400 focus:ring-danger-500 shadow-dark-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'bg-transparent text-gray-300 hover:bg-dark-elevated hover:text-amber-400 focus:ring-amber-500 border border-transparent hover:border-amber-500/20'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg'
  }
  
  return (
    <button
      type={type}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

