import React from 'react'
import '../styles/ProgressBar.css'

/**
 * 进度条组件
 * @param {number} percentage - 完成百分比 (0-100)
 * @param {boolean} isAchieved - 是否达成目标
 * @param {string} label - 标签文本
 * @param {string} actualValue - 实际值显示
 * @param {string} targetValue - 目标值显示
 * @param {string} investmentType - 投资类型 'stock' 或 'fund'
 */
export function ProgressBar({ 
  percentage, 
  isAchieved, 
  label, 
  actualValue, 
  targetValue,
  investmentType = 'stock'
}) {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100)
  
  // 根据投资类型设置颜色：股票红色，基金蓝色，达成目标绿色
  const getProgressColorClass = () => {
    if (isAchieved) {
      return 'bg-green-500' // 达成目标时使用绿色
    }
    return investmentType === 'stock' ? 'bg-red-500' : 'bg-blue-500' // 股票红色，基金蓝色
  }
  
  return (
    <div className="w-full py-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-sans font-semibold text-gray-300">{label}</span>
        <span className={`text-base font-display font-bold transition-colors ${isAchieved ? 'text-success-light' : 'text-amber-400'}`}>
          {clampedPercentage.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-6 bg-dark-border rounded-full overflow-hidden relative shadow-inner">
        <div 
          className={`h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2 relative ${
            isAchieved 
              ? 'bg-gradient-to-r from-success-base to-success-light shadow-glow-amber' 
              : investmentType === 'stock' 
                ? 'bg-gradient-to-r from-danger-base to-danger-light' 
                : 'bg-gradient-to-r from-amber-500 to-gold-base'
          } ${isAchieved ? 'animate-pulse' : ''}`}
          style={{ width: `${clampedPercentage}%` }}
        >
          {clampedPercentage >= 20 && (
            <span className="text-xs font-sans font-bold text-white drop-shadow-md">
              {clampedPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center mt-2 text-xs font-sans">
        <span className="text-gray-400">实际: <span className="text-gray-200 font-semibold">{actualValue}</span></span>
        <span className="text-gray-400">目标: <span className="text-gray-200 font-semibold">{targetValue}</span></span>
      </div>
    </div>
  )
}

