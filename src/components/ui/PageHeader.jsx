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
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-10 animate-stagger-1">
      <div className="relative">
        <h1 className="text-4xl lg:text-5xl font-display font-bold gradient-text-gold mb-3 tracking-tight decorative-line">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-400 text-base lg:text-lg font-sans font-medium">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="mt-6 lg:mt-0 flex items-center gap-3 animate-stagger-2">
          {actions}
        </div>
      )}
    </div>
  )
}

