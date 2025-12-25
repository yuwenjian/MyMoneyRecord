import React from 'react'
import '../styles/ProgressBar.css'

/**
 * 进度条组件
 * @param {number} percentage - 完成百分比 (0-100)
 * @param {boolean} isAchieved - 是否达成目标
 * @param {string} label - 标签文本
 * @param {string} actualValue - 实际值显示
 * @param {string} targetValue - 目标值显示
 */
export function ProgressBar({ 
  percentage, 
  isAchieved, 
  label, 
  actualValue, 
  targetValue 
}) {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100)
  
  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-bar-label">{label}</span>
        <span className={`progress-bar-percentage ${isAchieved ? 'achieved' : ''}`}>
          {clampedPercentage.toFixed(1)}%
        </span>
      </div>
      <div className="progress-bar-wrapper">
        <div 
          className={`progress-bar-fill ${isAchieved ? 'achieved' : ''}`}
          style={{ width: `${clampedPercentage}%` }}
        >
          {clampedPercentage >= 20 && (
            <span className="progress-bar-text">
              {clampedPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="progress-bar-footer">
        <span className="progress-bar-actual">实际: {actualValue}</span>
        <span className="progress-bar-target">目标: {targetValue}</span>
      </div>
    </div>
  )
}

