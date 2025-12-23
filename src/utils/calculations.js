// 计算每日盈亏
export function calculateDailyProfitLoss(record, prevRecord, adjustments) {
  if (!prevRecord) {
    return 0 // 第一条记录没有盈亏
  }

  // 获取当天相同投资类型的加减仓金额
  // 注意：加仓金额为正数，减仓金额为负数
  const dayAdjustments = adjustments
    .filter(a => a.date === record.date && a.investmentType === record.investmentType)
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)

  // 每日盈亏金额 = 今日总资产 - 加仓金额 + 减仓的金额 - 上个交易日记录总资产
  // 因为减仓金额在adjustments中已经是负数，所以公式简化为：
  // 每日盈亏 = 今日总资产 - dayAdjustments - 上个交易日总资产
  // 
  // 例如：
  // - 如果加仓1000，dayAdjustments = 1000，那么需要从今日总资产中减去这1000
  // - 如果减仓1000，dayAdjustments = -1000，那么需要从今日总资产中减去(-1000)，即加上1000
  const todayAsset = parseFloat(record.totalAsset) || 0
  const prevAsset = parseFloat(prevRecord.totalAsset) || 0
  const dailyProfitLoss = todayAsset - dayAdjustments - prevAsset
  
  // 调试日志（生产环境可以移除）
  if (process.env.NODE_ENV === 'development') {
    console.log('计算每日盈亏:', {
      date: record.date,
      investmentType: record.investmentType,
      todayAsset,
      prevAsset,
      dayAdjustments,
      dailyProfitLoss,
      recordTotalAsset: record.totalAsset,
      prevRecordTotalAsset: prevRecord.totalAsset,
      adjustments: adjustments.filter(a => a.date === record.date && a.investmentType === record.investmentType)
    })
  }
  
  return dailyProfitLoss
}

