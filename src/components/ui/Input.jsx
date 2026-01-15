import React from 'react'

/**
 * 统一输入框组件
 * @param {Object} props
 * @param {string} props.label - 标签文本
 * @param {string} props.error - 错误信息
 * @param {string} props.className - 额外的 CSS 类名
 */
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-300 mb-2.5">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-5 py-3.5 text-base font-sans
          border-2 rounded-xl
          bg-dark-elevated text-gray-100
          focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
          transition-all duration-300
          placeholder:text-gray-500
          ${error 
            ? 'border-danger-500/50 focus:border-danger-500 focus:ring-danger-500/30' 
            : 'border-dark-border hover:border-amber-500/30'
          }
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-2 text-sm text-danger-600 font-medium flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </p>
      )}
    </div>
  )
}

