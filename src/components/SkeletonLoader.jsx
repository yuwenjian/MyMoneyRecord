import React from 'react'
import '../styles/SkeletonLoader.css'

// 骨架屏加载组件
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton-line skeleton-title"></div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-text"></div>
        <div className="skeleton-line skeleton-text short"></div>
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="skeleton-chart">
      <div className="skeleton-chart-header">
        <div className="skeleton-line skeleton-title"></div>
      </div>
      <div className="skeleton-chart-content">
        <div className="skeleton-bar" style={{ height: '60%' }}></div>
        <div className="skeleton-bar" style={{ height: '80%' }}></div>
        <div className="skeleton-bar" style={{ height: '45%' }}></div>
        <div className="skeleton-bar" style={{ height: '70%' }}></div>
        <div className="skeleton-bar" style={{ height: '90%' }}></div>
        <div className="skeleton-bar" style={{ height: '55%' }}></div>
        <div className="skeleton-bar" style={{ height: '75%' }}></div>
      </div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-line skeleton-header-cell"></div>
        ))}
      </div>
      <div className="skeleton-table-body">
        {[1, 2, 3, 4, 5].map(row => (
          <div key={row} className="skeleton-table-row">
            {[1, 2, 3, 4, 5].map(cell => (
              <div key={cell} className="skeleton-line skeleton-cell"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div className="skeleton-stat-card">
      <div className="skeleton-icon"></div>
      <div className="skeleton-stat-content">
        <div className="skeleton-line skeleton-label"></div>
        <div className="skeleton-line skeleton-value"></div>
      </div>
    </div>
  )
}

