import dayjs from 'dayjs'

// 计算移动平均线
export function calculateMovingAverage(data, period = 5) {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      const slice = data.slice(i - period + 1, i + 1).filter(v => v !== null)
      if (slice.length > 0) {
        const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length
        result.push(avg)
      } else {
        result.push(null)
      }
    }
  }
  return result
}

// 按周期聚合数据
export function aggregateByPeriod(records, period) {
  if (period === 'day') {
    return records
  }

  const grouped = {}
  
  records.forEach(record => {
    const date = dayjs(record.date)
    let key
    
    if (period === 'week') {
      const weekStart = date.startOf('week')
      key = weekStart.format('YYYY-MM-DD')
    } else if (period === 'month') {
      key = date.format('YYYY-MM')
    } else if (period === 'year') {
      key = date.format('YYYY')
    }
    
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(record)
  })

  // 对每个周期取最后一条记录（代表该周期的最终状态）
  const aggregated = Object.keys(grouped).sort().map(key => {
    const periodRecords = grouped[key]
    return periodRecords[periodRecords.length - 1]
  })

  return aggregated
}

// 简单趋势预测（线性回归）
export function predictTrend(data, periods = 5) {
  const validData = data.filter(v => v !== null && v !== undefined)
  if (validData.length < 2) return []

  const n = validData.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  validData.forEach((y, index) => {
    const x = index + 1
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  })

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const predictions = []
  for (let i = 1; i <= periods; i++) {
    const x = n + i
    predictions.push(slope * x + intercept)
  }

  return predictions
}

