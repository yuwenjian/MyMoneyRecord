import dayjs from 'dayjs'
import { calculateDailyProfitLoss } from './calculations'

// 计算月度汇总统计
export function calculateMonthlyStats(records, adjustments, year, month) {
  const monthRecords = records.filter(record => {
    const recordDate = dayjs(record.date)
    return recordDate.year() === year && recordDate.month() + 1 === month
  })

  if (monthRecords.length === 0) {
    return null
  }

  const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
  
  let stockProfitLoss = 0
  let fundProfitLoss = 0
  let stockDays = 0
  let fundDays = 0
  let profitableStockDays = 0
  let profitableFundDays = 0
  let maxStockDrawdown = 0
  let maxFundDrawdown = 0
  let stockPeak = 0
  let fundPeak = 0

  monthRecords.forEach((record) => {
    const sameTypeRecords = sortedRecords.filter(r => r.investmentType === record.investmentType)
    const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date && r.objectId === record.objectId)
    let prevRecord = null
    if (recordIndex > 0) {
      prevRecord = sameTypeRecords[recordIndex - 1]
    }

    const dailyProfitLoss = calculateDailyProfitLoss(record, prevRecord, adjustments)

    if (record.investmentType === 'stock') {
      stockProfitLoss += dailyProfitLoss
      stockDays++
      if (dailyProfitLoss > 0) profitableStockDays++
      
      // 计算回撤
      const currentAsset = record.totalAsset || 0
      if (currentAsset > stockPeak) {
        stockPeak = currentAsset
      }
      const drawdown = ((stockPeak - currentAsset) / stockPeak) * 100
      if (drawdown > maxStockDrawdown) {
        maxStockDrawdown = drawdown
      }
    } else if (record.investmentType === 'fund') {
      fundProfitLoss += dailyProfitLoss
      fundDays++
      if (dailyProfitLoss > 0) profitableFundDays++
      
      // 计算回撤
      const currentAsset = record.totalAsset || 0
      if (currentAsset > fundPeak) {
        fundPeak = currentAsset
      }
      const drawdown = ((fundPeak - currentAsset) / fundPeak) * 100
      if (drawdown > maxFundDrawdown) {
        maxFundDrawdown = drawdown
      }
    }
  })

  // 获取月初和月末资产
  const monthStartRecords = monthRecords
    .filter(r => dayjs(r.date).date() === 1 || monthRecords.findIndex(rec => rec.date === r.date) === 0)
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
  
  const monthEndRecords = monthRecords
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))

  const stockStartRecord = monthStartRecords.find(r => r.investmentType === 'stock')
  const stockEndRecord = monthEndRecords.find(r => r.investmentType === 'stock')
  const fundStartRecord = monthStartRecords.find(r => r.investmentType === 'fund')
  const fundEndRecord = monthEndRecords.find(r => r.investmentType === 'fund')

  return {
    year,
    month,
    stock: {
      profitLoss: stockProfitLoss,
      days: stockDays,
      winRate: stockDays > 0 ? (profitableStockDays / stockDays) * 100 : 0,
      maxDrawdown: maxStockDrawdown,
      startAsset: stockStartRecord?.totalAsset || 0,
      endAsset: stockEndRecord?.totalAsset || 0,
      returnRate: stockStartRecord?.totalAsset > 0 
        ? ((stockEndRecord?.totalAsset || 0) - stockStartRecord.totalAsset) / stockStartRecord.totalAsset * 100 
        : 0
    },
    fund: {
      profitLoss: fundProfitLoss,
      days: fundDays,
      winRate: fundDays > 0 ? (profitableFundDays / fundDays) * 100 : 0,
      maxDrawdown: maxFundDrawdown,
      startAsset: fundStartRecord?.totalAsset || 0,
      endAsset: fundEndRecord?.totalAsset || 0,
      returnRate: fundStartRecord?.totalAsset > 0 
        ? ((fundEndRecord?.totalAsset || 0) - fundStartRecord.totalAsset) / fundStartRecord.totalAsset * 100 
        : 0
    },
    total: {
      profitLoss: stockProfitLoss + fundProfitLoss,
      days: Math.max(stockDays, fundDays),
      returnRate: 0 // 需要根据总资产计算
    }
  }
}

// 计算年度汇总统计
export function calculateYearlyStats(records, adjustments, year) {
  const yearRecords = records.filter(record => {
    return dayjs(record.date).year() === year
  })

  if (yearRecords.length === 0) {
    return null
  }

  const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
  
  let stockProfitLoss = 0
  let fundProfitLoss = 0
  let stockDays = 0
  let fundDays = 0
  let profitableStockDays = 0
  let profitableFundDays = 0
  let maxStockDrawdown = 0
  let maxFundDrawdown = 0
  let stockPeak = 0
  let fundPeak = 0

  yearRecords.forEach((record) => {
    const sameTypeRecords = sortedRecords.filter(r => r.investmentType === record.investmentType)
    const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date && r.objectId === record.objectId)
    let prevRecord = null
    if (recordIndex > 0) {
      prevRecord = sameTypeRecords[recordIndex - 1]
    }

    const dailyProfitLoss = calculateDailyProfitLoss(record, prevRecord, adjustments)

    if (record.investmentType === 'stock') {
      stockProfitLoss += dailyProfitLoss
      stockDays++
      if (dailyProfitLoss > 0) profitableStockDays++
      
      const currentAsset = record.totalAsset || 0
      if (currentAsset > stockPeak) {
        stockPeak = currentAsset
      }
      const drawdown = ((stockPeak - currentAsset) / stockPeak) * 100
      if (drawdown > maxStockDrawdown) {
        maxStockDrawdown = drawdown
      }
    } else if (record.investmentType === 'fund') {
      fundProfitLoss += dailyProfitLoss
      fundDays++
      if (dailyProfitLoss > 0) profitableFundDays++
      
      const currentAsset = record.totalAsset || 0
      if (currentAsset > fundPeak) {
        fundPeak = currentAsset
      }
      const drawdown = ((fundPeak - currentAsset) / fundPeak) * 100
      if (drawdown > maxFundDrawdown) {
        maxFundDrawdown = drawdown
      }
    }
  })

  // 获取年初和年末资产
  const yearStartRecords = yearRecords
    .filter(r => {
      const date = dayjs(r.date)
      return date.month() === 0 && date.date() === 1 || yearRecords.findIndex(rec => rec.date === r.date) === 0
    })
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
  
  const yearEndRecords = yearRecords
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))

  const stockStartRecord = yearStartRecords.find(r => r.investmentType === 'stock')
  const stockEndRecord = yearEndRecords.find(r => r.investmentType === 'stock')
  const fundStartRecord = yearStartRecords.find(r => r.investmentType === 'fund')
  const fundEndRecord = yearEndRecords.find(r => r.investmentType === 'fund')

  return {
    year,
    stock: {
      profitLoss: stockProfitLoss,
      days: stockDays,
      winRate: stockDays > 0 ? (profitableStockDays / stockDays) * 100 : 0,
      maxDrawdown: maxStockDrawdown,
      startAsset: stockStartRecord?.totalAsset || 0,
      endAsset: stockEndRecord?.totalAsset || 0,
      returnRate: stockStartRecord?.totalAsset > 0 
        ? ((stockEndRecord?.totalAsset || 0) - stockStartRecord.totalAsset) / stockStartRecord.totalAsset * 100 
        : 0,
      annualizedReturn: stockStartRecord?.totalAsset > 0 && stockDays > 0
        ? Math.pow((stockEndRecord?.totalAsset || 0) / stockStartRecord.totalAsset, 365 / stockDays) - 1
        : 0
    },
    fund: {
      profitLoss: fundProfitLoss,
      days: fundDays,
      winRate: fundDays > 0 ? (profitableFundDays / fundDays) * 100 : 0,
      maxDrawdown: maxFundDrawdown,
      startAsset: fundStartRecord?.totalAsset || 0,
      endAsset: fundEndRecord?.totalAsset || 0,
      returnRate: fundStartRecord?.totalAsset > 0 
        ? ((fundEndRecord?.totalAsset || 0) - fundStartRecord.totalAsset) / fundStartRecord.totalAsset * 100 
        : 0,
      annualizedReturn: fundStartRecord?.totalAsset > 0 && fundDays > 0
        ? Math.pow((fundEndRecord?.totalAsset || 0) / fundStartRecord.totalAsset, 365 / fundDays) - 1
        : 0
    },
    total: {
      profitLoss: stockProfitLoss + fundProfitLoss,
      days: Math.max(stockDays, fundDays)
    }
  }
}

// 获取所有有数据的年月
export function getAvailablePeriods(records) {
  const months = new Set()
  const years = new Set()
  
  records.forEach(record => {
    const date = dayjs(record.date)
    months.add(`${date.year()}-${String(date.month() + 1).padStart(2, '0')}`)
    years.add(date.year())
  })
  
  return {
    months: Array.from(months).sort(),
    years: Array.from(years).sort((a, b) => b - a)
  }
}

