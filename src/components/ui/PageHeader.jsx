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
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 lg:mb-10 animate-stagger-1">
      <div className="relative">
        <h1 className="text-2xl lg:text-4xl xl:text-5xl font-display font-bold text-amber-400 mb-2 lg:mb-3 tracking-tight flex items-center gap-2 lg:gap-3">
          <span className="w-0.5 h-6 lg:h-10 xl:h-12 bg-amber-400 rounded-full"></span>
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-400 text-sm lg:text-base xl:text-lg font-sans font-medium ml-3 lg:ml-4">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="mt-4 lg:mt-6 xl:mt-0 flex items-center gap-3 animate-stagger-2">
          {actions}
        </div>
      )}
    </div>
  )
}

