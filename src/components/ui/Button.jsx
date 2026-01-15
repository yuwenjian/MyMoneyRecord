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
  const baseClasses = 'font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95'
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-700 hover:to-primary-600 focus:ring-primary-500 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md',
    secondary: 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:ring-primary-500 shadow-sm hover:shadow-md',
    danger: 'bg-gradient-to-r from-danger-600 to-danger-500 text-white hover:from-danger-700 hover:to-danger-600 focus:ring-danger-500 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-primary-500'
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

