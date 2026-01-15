import React from 'react'

/**
 * 统一选择框组件
 * @param {Object} props
 * @param {string} props.label - 标签文本
 * @param {string} props.error - 错误信息
 * @param {Array} props.options - 选项数组 [{ value, label }]
 * @param {string} props.className - 额外的 CSS 类名
 */
export function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2.5
          border-2 rounded-xl
          bg-dark-elevated text-gray-200
          focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
          transition-all duration-300
          font-sans
          ${error 
            ? 'border-danger-500/50 focus:border-danger-500 focus:ring-danger-500/30' 
            : 'border-dark-border hover:border-amber-500/30'
          }
          ${className}
        `}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-danger-600 font-medium flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </p>
      )}
    </div>
  )
}

