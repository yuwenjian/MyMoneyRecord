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
        <label className="block text-sm font-semibold text-gray-700 mb-2.5">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-3 text-base
          border-2 rounded-xl
          bg-white
          focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
          transition-all duration-200
          placeholder:text-gray-400
          ${error 
            ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20' 
            : 'border-gray-200 hover:border-gray-300'
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

