import React from 'react'

/**
 * 统一页面头部组件
 * @param {Object} props
 * @param {string} props.title - 页面标题
 * @param {string} props.subtitle - 副标题
 * @param {React.ReactNode} props.actions - 右侧操作按钮
 */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
        {subtitle && (
          <p className="text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="mt-4 lg:mt-0">
          {actions}
        </div>
      )}
    </div>
  )
}

