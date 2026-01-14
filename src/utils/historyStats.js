import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { calculateDailyProfitLoss } from './calculations'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

/**
 * 计算历史统计数据
 * @param {Array} records - 所有记录
 * @param {Array} adjustments - 所有加减仓记录
 * @param {number} days - 统计天数（7天或30天）
 * @returns {Object} 统计数据
 */
export function calculateHistoryStats(records, adjustments, days = 30) {
  const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
  const endDate = dayjs()
  const startDate = endDate.subtract(days - 1, 'day')
  
  // 筛选日期范围内的记录
  const periodRecords = sortedRecords.filter(r => {
    const recordDate = dayjs(r.date)
    return recordDate.isSameOrAfter(startDate, 'day') && recordDate.isSameOrBefore(endDate, 'day')
  })
  
  if (periodRecords.length === 0) {
    return null
  }
  
  // 找到周期开始前的最后一条记录（作为基准）
  const beforePeriodRecords = sortedRecords.filter(r => 
    dayjs(r.date).isBefore(startDate, 'day')
  )
  const baseRecord = beforePeriodRecords.length > 0 
    ? beforePeriodRecords[beforePeriodRecords.length - 1]
    : periodRecords[0]
  
  // 按日期聚合总资产和盈亏
  const dateMap = new Map()
  const dailyProfits = []
  let totalProfit = 0
  let profitableDays = 0
  let totalDays = 0
  let peakAsset = baseRecord ? (baseRecord.totalAsset || 0) : 0
  let maxDrawdown = 0
  let maxDrawdownPercent = 0
  
  // 计算每日总资产和盈亏
  const allDates = new Set()
  periodRecords.forEach(r => allDates.add(r.date))
  sortedRecords.filter(r => {
    const recordDate = dayjs(r.date)
    return recordDate.isSameOrAfter(startDate, 'day') && recordDate.isSameOrBefore(endDate, 'day')
  }).forEach(r => allDates.add(r.date))
  
  Array.from(allDates).sort((a, b) => dayjs(a).diff(dayjs(b))).forEach(date => {
    const dayRecords = sortedRecords.filter(r => r.date === date)
    const stockRecord = dayRecords.find(r => r.investmentType === 'stock')
    const fundRecord = dayRecords.find(r => r.investmentType === 'fund')
    
    const stockAsset = stockRecord ? (stockRecord.totalAsset || 0) : 0
    const fundAsset = fundRecord ? (fundRecord.totalAsset || 0) : 0
    const totalAsset = stockAsset + fundAsset
    
    // 计算当日盈亏
    let dailyProfit = 0
    const prevDate = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD')
    const prevDayRecords = sortedRecords.filter(r => r.date === prevDate)
    const prevStockRecord = prevDayRecords.find(r => r.investmentType === 'stock')
    const prevFundRecord = prevDayRecords.find(r => r.investmentType === 'fund')
    
    if (stockRecord && prevStockRecord) {
      dailyProfit += calculateDailyProfitLoss(stockRecord, prevStockRecord, adjustments)
    } else if (stockRecord && !prevStockRecord) {
      // 找到股票类型的前一条记录
      const prevStock = sortedRecords
        .filter(r => r.investmentType === 'stock' && dayjs(r.date).isBefore(dayjs(date), 'day'))
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
      if (prevStock) {
        dailyProfit += calculateDailyProfitLoss(stockRecord, prevStock, adjustments)
      }
    }
    
    if (fundRecord && prevFundRecord) {
      dailyProfit += calculateDailyProfitLoss(fundRecord, prevFundRecord, adjustments)
    } else if (fundRecord && !prevFundRecord) {
      // 找到基金类型的前一条记录
      const prevFund = sortedRecords
        .filter(r => r.investmentType === 'fund' && dayjs(r.date).isBefore(dayjs(date), 'day'))
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
      if (prevFund) {
        dailyProfit += calculateDailyProfitLoss(fundRecord, prevFund, adjustments)
      }
    }
    
    if (totalAsset > 0 || dailyProfit !== 0) {
      totalDays++
      totalProfit += dailyProfit
      if (dailyProfit > 0) profitableDays++
      dailyProfits.push(dailyProfit)
      
      // 计算回撤
      if (totalAsset > peakAsset) {
        peakAsset = totalAsset
      }
      const drawdown = peakAsset > 0 ? peakAsset - totalAsset : 0
      const drawdownPercent = peakAsset > 0 ? (drawdown / peakAsset) * 100 : 0
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
      if (drawdownPercent > maxDrawdownPercent) {
        maxDrawdownPercent = drawdownPercent
      }
    }
  })
  
  // 计算波动性（标准差）
  const avgProfit = dailyProfits.length > 0 ? totalProfit / dailyProfits.length : 0
  const variance = dailyProfits.length > 0
    ? dailyProfits.reduce((sum, profit) => sum + Math.pow(profit - avgProfit, 2), 0) / dailyProfits.length
    : 0
  const volatility = Math.sqrt(variance)
  
  // 计算收益率
  // 对于总资产，需要找到周期开始和结束时的总资产（股票+基金）
  let startAsset = 0
  let endAsset = 0
  
  if (baseRecord) {
    startAsset = baseRecord.totalAsset || 0
  } else {
    // 如果没有基准记录，找到周期开始时的总资产
    const startDateRecords = sortedRecords.filter(r => {
      const recordDate = dayjs(r.date)
      return recordDate.isSameOrBefore(startDate, 'day')
    }).sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))
    
    if (startDateRecords.length > 0) {
      // 按日期聚合，找到最近一天的总资产
      const startDateMap = new Map()
      startDateRecords.forEach(r => {
        const date = r.date
        if (!startDateMap.has(date)) {
          startDateMap.set(date, { stock: 0, fund: 0 })
        }
        const assets = startDateMap.get(date)
        if (r.investmentType === 'stock') {
          assets.stock = r.totalAsset || 0
        } else if (r.investmentType === 'fund') {
          assets.fund = r.totalAsset || 0
        }
      })
      const latestStartDate = Array.from(startDateMap.keys()).sort((a, b) => dayjs(b).diff(dayjs(a)))[0]
      if (latestStartDate) {
        const assets = startDateMap.get(latestStartDate)
        startAsset = (assets.stock || 0) + (assets.fund || 0)
      }
    }
  }
  
  // 找到周期结束时的总资产
  const endDateMap = new Map()
  periodRecords.forEach(r => {
    const date = r.date
    if (!endDateMap.has(date)) {
      endDateMap.set(date, { stock: 0, fund: 0 })
    }
    const assets = endDateMap.get(date)
    if (r.investmentType === 'stock') {
      assets.stock = r.totalAsset || 0
    } else if (r.investmentType === 'fund') {
      assets.fund = r.totalAsset || 0
    }
  })
  const latestEndDate = Array.from(endDateMap.keys()).sort((a, b) => dayjs(b).diff(dayjs(a)))[0]
  if (latestEndDate) {
    const assets = endDateMap.get(latestEndDate)
    endAsset = (assets.stock || 0) + (assets.fund || 0)
  } else {
    // 如果没有周期内的记录，使用最后一条记录
    const latestRecord = periodRecords[periodRecords.length - 1]
    endAsset = latestRecord ? (latestRecord.totalAsset || 0) : 0
  }
  
  const returnRate = startAsset > 0 ? ((endAsset - startAsset) / startAsset) * 100 : 0
  
  return {
    days,
    totalDays,
    totalProfit,
    profitableDays,
    winRate: totalDays > 0 ? (profitableDays / totalDays) * 100 : 0,
    maxDrawdown,
    maxDrawdownPercent,
    volatility,
    avgDailyProfit: totalDays > 0 ? totalProfit / totalDays : 0,
    startAsset,
    endAsset,
    returnRate,
    dailyProfits: dailyProfits.slice(-10) // 只保留最近10天的盈亏数据用于展示趋势
  }
}

/**
 * 计算股票和基金分别的历史统计
 */
export function calculateHistoryStatsByType(records, adjustments, days = 30) {
  const stockRecords = records.filter(r => r.investmentType === 'stock')
  const fundRecords = records.filter(r => r.investmentType === 'fund')
  
  return {
    stock: calculateHistoryStats(stockRecords, adjustments, days),
    fund: calculateHistoryStats(fundRecords, adjustments, days),
    total: calculateHistoryStats(records, adjustments, days)
  }
}

