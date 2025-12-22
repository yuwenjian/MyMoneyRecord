// 计算每日盈亏
export function calculateDailyProfitLoss(record, prevRecord, adjustments) {
  if (!prevRecord) {
    return 0 // 第一条记录没有盈亏
  }

  // 获取当天的加减仓金额
  const dayAdjustments = adjustments
    .filter(a => a.date === record.date)
    .reduce((sum, a) => sum + a.amount, 0)

  // 每日盈亏金额 = 今日总资产 - 加仓金额 + 减仓的金额 - 上个交易日记录总资产
  // 简化：今日总资产 - dayAdjustments - 上个交易日总资产
  const dailyProfitLoss = (record.totalAsset || 0) - dayAdjustments - (prevRecord.totalAsset || 0)
  
  return dailyProfitLoss
}

