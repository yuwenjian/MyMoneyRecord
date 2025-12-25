import dayjs from 'dayjs'
import { calculateDailyProfitLoss } from './calculations'

/**
 * 获取周期的开始和结束日期
 * @param {string} period - 'week', 'month', 'year'
 * @param {string} periodStartDate - 周期开始日期（可选，用于周目标）
 * @returns {Object} { startDate, endDate }
 */
export function getPeriodDates(period, periodStartDate = null) {
  const today = dayjs()
  let startDate, endDate

  switch (period) {
    case 'week':
      if (periodStartDate) {
        // 使用指定的周期开始日期
        startDate = dayjs(periodStartDate)
        endDate = startDate.add(6, 'day') // 一周7天
      } else {
        // 默认使用本周一
        startDate = today.startOf('week').add(1, 'day') // 周一
        endDate = startDate.add(6, 'day') // 周日
      }
      break
    case 'month':
      startDate = today.startOf('month')
      endDate = today.endOf('month')
      break
    case 'year':
      startDate = today.startOf('year')
      endDate = today.endOf('year')
      break
    default:
      startDate = today.startOf('day')
      endDate = today.endOf('day')
  }

  return {
    startDate: startDate.format('YYYY-MM-DD'),
    endDate: endDate.format('YYYY-MM-DD')
  }
}

/**
 * 计算周期内的实际收益
 * @param {Array} records - 所有记录
 * @param {Array} adjustments - 所有加减仓记录
 * @param {string} investmentType - 'stock' 或 'fund'
 * @param {string} period - 'week', 'month', 'year'
 * @param {string} periodStartDate - 周期开始日期（可选）
 * @returns {number} 实际收益金额
 */
export function calculatePeriodProfit(records, adjustments, investmentType, period, periodStartDate = null) {
  const { startDate, endDate } = getPeriodDates(period, periodStartDate)
  
  // 筛选该投资类型和日期范围内的记录
  const filteredRecords = records
    .filter(r => r.investmentType === investmentType)
    .filter(r => r.date >= startDate && r.date <= endDate)
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))

  if (filteredRecords.length === 0) {
    return 0
  }

  // 找到周期开始前的最后一条记录（作为基准）
  const beforePeriodRecords = records
    .filter(r => r.investmentType === investmentType)
    .filter(r => r.date < startDate)
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))
  
  const baseRecord = beforePeriodRecords[0] || filteredRecords[0]
  
  // 计算周期内每日盈亏的累加
  let totalProfit = 0
  const sortedAllRecords = records
    .filter(r => r.investmentType === investmentType)
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))

  filteredRecords.forEach((record) => {
    const recordIndex = sortedAllRecords.findIndex(r => 
      r.date === record.date && 
      (r.objectId === record.objectId || (!r.objectId && !record.objectId))
    )
    const prevRecord = recordIndex > 0 ? sortedAllRecords[recordIndex - 1] : baseRecord
    
    const dailyProfit = calculateDailyProfitLoss(record, prevRecord, adjustments)
    totalProfit += dailyProfit
  })

  return totalProfit
}

/**
 * 计算目标完成度
 * @param {number} actualProfit - 实际收益
 * @param {number} targetAmount - 目标金额
 * @returns {Object} { percentage, isAchieved }
 */
export function calculateTargetProgress(actualProfit, targetAmount) {
  if (!targetAmount || targetAmount === 0) {
    return {
      percentage: 0,
      isAchieved: false,
      remaining: 0
    }
  }

  const percentage = Math.min((actualProfit / targetAmount) * 100, 100)
  const isAchieved = actualProfit >= targetAmount
  const remaining = Math.max(targetAmount - actualProfit, 0)

  return {
    percentage: Math.round(percentage * 100) / 100, // 保留2位小数
    isAchieved,
    remaining
  }
}

/**
 * 获取目标进度信息
 * @param {Object} target - 目标对象
 * @param {Array} records - 所有记录
 * @param {Array} adjustments - 所有加减仓记录
 * @returns {Object} 进度信息
 */
export function getTargetProgress(target, records, adjustments) {
  const { investmentType, period, targetAmount, periodStartDate } = target
  
  const actualProfit = calculatePeriodProfit(
    records,
    adjustments,
    investmentType,
    period,
    periodStartDate
  )
  
  const progress = calculateTargetProgress(actualProfit, targetAmount)
  const { startDate, endDate } = getPeriodDates(period, periodStartDate)
  
  return {
    ...target,
    actualProfit,
    ...progress,
    startDate,
    endDate
  }
}

