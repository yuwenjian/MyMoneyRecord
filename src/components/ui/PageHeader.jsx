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
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 animate-fade-in">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold gradient-text mb-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-600 text-base lg:text-lg font-medium">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="mt-4 lg:mt-0 flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}

