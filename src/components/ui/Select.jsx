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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2
          border rounded-lg
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          transition-colors
          ${error 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300'
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
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

