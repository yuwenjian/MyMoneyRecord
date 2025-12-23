import React from 'react'
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi'
import '../styles/TrendIndicator.css'

// 趋势指示器组件
export function TrendIndicator({ value, showArrow = true, showSign = false, className = '' }) {
  if (value === null || value === undefined) {
    return <span className={`trend-indicator neutral ${className}`}>--</span>
  }

  // 解析数值，去除所有符号和逗号
  const parseValue = () => {
    if (typeof value === 'string') {
      // 去除字符串中可能存在的 + 和 - 符号以及逗号
      const cleanValue = value.replace(/[+\-]/g, '').replace(/,/g, '').trim()
      const parsed = parseFloat(cleanValue)
      if (isNaN(parsed)) return 0
      // 确保 0 值返回正数 0
      return parsed === 0 ? 0 : parsed
    }
    // 确保 0 值返回正数 0，而不是 -0
    if (value === 0 || value === -0 || Math.abs(value) < 0.0001) {
      return 0
    }
    return value
  }

  const numValue = parseValue()
  const absValue = Math.abs(numValue)
  // 判断是否为 0（考虑浮点数精度问题）
  const isZero = absValue < 0.0001 || numValue === 0 || numValue === -0
  const isPositive = !isZero && numValue > 0
  const isNegative = !isZero && numValue < 0

  const getIcon = () => {
    if (isPositive) return <FiTrendingUp className="trend-icon up" />
    if (isNegative) return <FiTrendingDown className="trend-icon down" />
    // 0 时不显示任何符号/图标（避免出现 “— 0.00”）
    return null
  }

  const getClass = () => {
    if (isPositive) return 'positive'
    if (isNegative) return 'negative'
    return 'neutral'
  }

  // 格式化显示值：根据数值正负添加符号
  const formatDisplayValue = () => {
    // 如果是 0（包括 -0），不显示符号，只显示 0.00
    if (isZero) {
      return '0.00'
    }
    
    // 格式化数字（保留两位小数，添加千分位逗号）
    const formatted = absValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    
    // 负数显示 -，正数不显示 +，0 不显示符号
    return isNegative ? `-${formatted}` : formatted
  }

  return (
    <span className={`trend-indicator ${getClass()} ${className}`}>
      {showArrow && getIcon()}
      {formatDisplayValue()}
    </span>
  )
}

// 百分比趋势指示器
export function PercentTrendIndicator({ value, showArrow = true, className = '' }) {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className={`trend-indicator neutral ${className}`}>--</span>
  }

  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  const absValue = Math.abs(numValue)
  const isZero = absValue < 0.0001 || numValue === 0 || numValue === -0
  const isPositive = !isZero && numValue > 0
  const isNegative = !isZero && numValue < 0

  const getIcon = () => {
    if (isPositive) return <FiTrendingUp className="trend-icon up" />
    if (isNegative) return <FiTrendingDown className="trend-icon down" />
    return null
  }

  const getClass = () => {
    if (isPositive) return 'positive'
    if (isNegative) return 'negative'
    return 'neutral'
  }

  const formattedValue =
    typeof value === 'string'
      ? value
      : isZero
        ? '0.00%'
        : `${numValue < 0 ? '-' : ''}${absValue.toFixed(2)}%`

  return (
    <span className={`trend-indicator ${getClass()} ${className}`}>
      {showArrow && getIcon()}
      {formattedValue}
    </span>
  )
}

