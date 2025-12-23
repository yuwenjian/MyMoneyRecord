import dayjs from 'dayjs'
import { calculateDailyProfitLoss } from './calculations'

// 计算时间段统计
export function calculatePeriodStats(records, adjustments, startDate, endDate) {
  if (!startDate || !endDate) return null

  const filteredRecords = records.filter(record => {
    const recordDate = dayjs(record.date)
    return recordDate.isSameOrAfter(dayjs(startDate), 'day') && 
           recordDate.isSameOrBefore(dayjs(endDate), 'day')
  })

  if (filteredRecords.length === 0) return null

  const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
  
  let stockProfitLoss = 0
  let fundProfitLoss = 0
  let stockDays = 0
  let fundDays = 0
  let profitableStockDays = 0
  let profitableFundDays = 0

  // 获取期初和期末资产
  const stockStartRecord = sortedRecords
    .filter(r => r.investmentType === 'stock' && dayjs(r.date).isBefore(dayjs(startDate), 'day'))
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
  
  const stockEndRecord = filteredRecords
    .filter(r => r.investmentType === 'stock')
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
  
  const fundStartRecord = sortedRecords
    .filter(r => r.investmentType === 'fund' && dayjs(r.date).isBefore(dayjs(startDate), 'day'))
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
  
  const fundEndRecord = filteredRecords
    .filter(r => r.investmentType === 'fund')
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]

  filteredRecords.forEach((record) => {
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
    } else if (record.investmentType === 'fund') {
      fundProfitLoss += dailyProfitLoss
      fundDays++
      if (dailyProfitLoss > 0) profitableFundDays++
    }
  })

  const stockStartAsset = stockStartRecord?.totalAsset || (filteredRecords.find(r => r.investmentType === 'stock')?.totalAsset || 0)
  const stockEndAsset = stockEndRecord?.totalAsset || stockStartAsset
  const fundStartAsset = fundStartRecord?.totalAsset || (filteredRecords.find(r => r.investmentType === 'fund')?.totalAsset || 0)
  const fundEndAsset = fundEndRecord?.totalAsset || fundStartAsset

  return {
    startDate,
    endDate,
    stock: {
      profitLoss: stockProfitLoss,
      days: stockDays,
      winRate: stockDays > 0 ? (profitableStockDays / stockDays) * 100 : 0,
      startAsset: stockStartAsset,
      endAsset: stockEndAsset,
      returnRate: stockStartAsset > 0 ? ((stockEndAsset - stockStartAsset) / stockStartAsset) * 100 : 0
    },
    fund: {
      profitLoss: fundProfitLoss,
      days: fundDays,
      winRate: fundDays > 0 ? (profitableFundDays / fundDays) * 100 : 0,
      startAsset: fundStartAsset,
      endAsset: fundEndAsset,
      returnRate: fundStartAsset > 0 ? ((fundEndAsset - fundStartAsset) / fundStartAsset) * 100 : 0
    },
    total: {
      profitLoss: stockProfitLoss + fundProfitLoss,
      returnRate: (stockStartAsset + fundStartAsset) > 0 
        ? (((stockEndAsset + fundEndAsset) - (stockStartAsset + fundStartAsset)) / (stockStartAsset + fundStartAsset)) * 100 
        : 0
    }
  }
}

