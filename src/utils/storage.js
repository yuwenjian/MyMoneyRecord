import AV from '../config/leancloud'

// 数据表名
const TABLE_NAME = 'MyMoney'

// 获取所有记录
export async function getRecords() {
  try {
    const query = new AV.Query(TABLE_NAME)
    query.ascending('date')
    const results = await query.find()
    
    return results.map(item => {
      const investmentType = item.get('investmentType')
      const totalAsset = item.get('totalAsset')
      const totalMarketValue = item.get('totalMarketValue')
      const shanghaiIndex = item.get('shanghaiIndex')
      
      return {
        date: item.get('date'),
        // 确保 totalAsset 是数字类型
        totalAsset: totalAsset !== null && totalAsset !== undefined ? parseFloat(totalAsset) : 0,
        // 只有股票类型才返回总市值，基金类型返回 null
        totalMarketValue: investmentType === 'stock' && totalMarketValue !== null && totalMarketValue !== undefined 
          ? parseFloat(totalMarketValue) 
          : null,
        investmentType: investmentType,
        shanghaiIndex: shanghaiIndex !== null && shanghaiIndex !== undefined ? parseFloat(shanghaiIndex) : null,
        notes: item.get('notes') || '',
        objectId: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    })
  } catch (error) {
    return []
  }
}

// 保存记录
export async function saveRecord(record) {
  try {
    if (!AV || !AV.Query || !AV.Object) {
      throw new Error('LeanCloud 未正确初始化，AV 对象不存在')
    }
    
    const { date, totalAsset, totalMarketValue, investmentType, shanghaiIndex, notes, objectId } = record
    
    let MoneyRecord
    
    // 如果提供了 objectId，说明是更新现有记录
    if (objectId) {
      MoneyRecord = AV.Object.createWithoutData(TABLE_NAME, objectId)
    } else {
      // 否则查询该日期和投资类型的记录（同一日期可以有不同的投资类型记录）
      const query = new AV.Query(TABLE_NAME)
      query.equalTo('date', date)
      query.equalTo('investmentType', investmentType)
      const existing = await query.first()
      
      if (existing) {
        MoneyRecord = AV.Object.createWithoutData(TABLE_NAME, existing.id)
      } else {
        MoneyRecord = new AV.Object(TABLE_NAME)
      }
    }
    
    MoneyRecord.set('date', date)
    MoneyRecord.set('totalAsset', totalAsset)
    // 只有股票类型才设置总市值，基金类型不设置或删除该字段
    if (investmentType === 'stock' && totalMarketValue !== null && totalMarketValue !== undefined) {
      MoneyRecord.set('totalMarketValue', totalMarketValue)
    } else if (investmentType === 'fund') {
      // 如果是基金类型，删除 totalMarketValue 字段（如果存在）
      MoneyRecord.unset('totalMarketValue')
    }
    MoneyRecord.set('investmentType', investmentType)
    if (shanghaiIndex !== null && shanghaiIndex !== undefined) {
      MoneyRecord.set('shanghaiIndex', shanghaiIndex)
    }
    MoneyRecord.set('notes', notes || '')
    
    const savedRecord = await MoneyRecord.save()
    
    return {
      date,
      totalAsset,
      totalMarketValue: investmentType === 'stock' ? totalMarketValue : null,
      investmentType,
      shanghaiIndex,
      notes: notes || '',
      objectId: savedRecord.id
    }
  } catch (error) {
    throw new Error(`保存失败: ${error.message || error.toString()}`)
  }
}

// 删除记录（根据日期和投资类型）
export async function deleteRecord(date, investmentType) {
  try {
    const query = new AV.Query(TABLE_NAME)
    query.equalTo('date', date)
    if (investmentType) {
      query.equalTo('investmentType', investmentType)
    }
    const record = await query.first()
    
    if (record) {
      await record.destroy()
      return true
    }
    return false
  } catch (error) {
    throw error
  }
}

// 获取所有加减仓记录
export async function getAdjustments() {
  try {
    const query = new AV.Query('Adjustment')
    query.ascending('date')
    const results = await query.find()
    
    return results.map(item => {
      const amount = item.get('amount')
      return {
        id: item.id,
        date: item.get('date'),
        // 确保 amount 是数字类型
        amount: amount !== null && amount !== undefined ? parseFloat(amount) : 0,
        notes: item.get('notes') || '',
        investmentType: item.get('investmentType') || null,
        createdAt: item.createdAt
      }
    })
  } catch (error) {
    return []
  }
}

// 保存加减仓记录
export async function saveAdjustment(adjustment) {
  try {
    const { date, amount, notes, investmentType } = adjustment
    
    // 删除该日期和投资类型已有的加减仓记录
    const query = new AV.Query('Adjustment')
    query.equalTo('date', date)
    if (investmentType) {
      query.equalTo('investmentType', investmentType)
    }
    const existing = await query.find()
    
    if (existing.length > 0) {
      await AV.Object.destroyAll(existing)
    }
    
    // 如果金额为0或未提供，则不创建记录（相当于删除）
    if (!amount || amount === 0) {
      return null
    }
    
    // 创建新记录
    const Adjustment = new AV.Object('Adjustment')
    Adjustment.set('date', date)
    Adjustment.set('amount', amount)
    Adjustment.set('notes', notes || '')
    if (investmentType) {
      Adjustment.set('investmentType', investmentType)
    }
    
    await Adjustment.save()
    
    return {
      id: Adjustment.id,
      date,
      amount,
      notes: notes || '',
      investmentType: investmentType || null
    }
  } catch (error) {
    throw error
  }
}

// 删除加减仓记录
export async function deleteAdjustment(id) {
  try {
    const adjustment = AV.Object.createWithoutData('Adjustment', id)
    await adjustment.destroy()
    return true
  } catch (error) {
    throw error
  }
}

// 删除指定日期的加减仓记录（可指定投资类型）
export async function deleteAdjustmentByDate(date, investmentType) {
  try {
    const query = new AV.Query('Adjustment')
    query.equalTo('date', date)
    if (investmentType) {
      query.equalTo('investmentType', investmentType)
    }
    const existing = await query.find()
    if (existing.length > 0) {
      await AV.Object.destroyAll(existing)
    }
    return true
  } catch (error) {
    throw error
  }
}

// 格式化日期（处理时区问题）
export function formatDate(dateString) {
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  
  // 如果是 Date 对象或其他格式，使用本地时间
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化货币
export function formatCurrency(amount, showSign = false) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '--'
  }
  
  const sign = showSign ? (amount >= 0 ? '+' : '') : ''
  return sign + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ========== 收益目标管理 ==========

// 获取所有收益目标
export async function getProfitTargets() {
  try {
    const query = new AV.Query('ProfitTarget')
    query.ascending('investmentType')
    query.ascending('period')
    const results = await query.find()
    
    return results.map(item => ({
      objectId: item.id,
      investmentType: item.get('investmentType'),
      period: item.get('period'), // 'week', 'month', 'year'
      targetAmount: parseFloat(item.get('targetAmount')) || 0,
      periodStartDate: item.get('periodStartDate'), // 周期开始日期
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  } catch (error) {
    console.error('获取收益目标失败:', error)
    return []
  }
}

// 保存收益目标
export async function saveProfitTarget(target) {
  try {
    if (!AV || !AV.Query || !AV.Object) {
      throw new Error('LeanCloud 未正确初始化，AV 对象不存在')
    }

    const { investmentType, period, targetAmount, periodStartDate, objectId } = target
    
    // 验证必填字段
    if (!investmentType || !period || targetAmount === undefined || targetAmount === null) {
      throw new Error('缺少必填字段：investmentType、period、targetAmount')
    }

    // 验证投资类型
    if (investmentType !== 'stock' && investmentType !== 'fund') {
      throw new Error('investmentType 必须是 "stock" 或 "fund"')
    }

    // 验证周期
    if (period !== 'week' && period !== 'month' && period !== 'year') {
      throw new Error('period 必须是 "week"、"month" 或 "year"')
    }

    // 验证目标金额
    const amount = parseFloat(targetAmount)
    if (isNaN(amount) || amount < 0) {
      throw new Error('targetAmount 必须是有效的正数')
    }
    
    let TargetRecord
    
    if (objectId) {
      // 更新现有目标
      TargetRecord = AV.Object.createWithoutData('ProfitTarget', objectId)
    } else {
      // 检查是否已存在相同类型和周期的目标
      const query = new AV.Query('ProfitTarget')
      query.equalTo('investmentType', investmentType)
      query.equalTo('period', period)
      const existing = await query.first()
      
      if (existing) {
        TargetRecord = AV.Object.createWithoutData('ProfitTarget', existing.id)
      } else {
        TargetRecord = new AV.Object('ProfitTarget')
      }
    }
    
    TargetRecord.set('investmentType', investmentType)
    TargetRecord.set('period', period)
    TargetRecord.set('targetAmount', amount)
    
    // 只有周目标才设置周期开始日期
    if (period === 'week' && periodStartDate) {
      TargetRecord.set('periodStartDate', periodStartDate)
    } else if (period === 'week' && !periodStartDate) {
      // 如果周目标没有提供开始日期，删除该字段（使用默认值）
      TargetRecord.unset('periodStartDate')
    } else {
      // 非周目标不设置周期开始日期
      TargetRecord.unset('periodStartDate')
    }
    
    const saved = await TargetRecord.save()
    
    return {
      objectId: saved.id,
      investmentType,
      period,
      targetAmount: amount,
      periodStartDate: (period === 'week' && periodStartDate) ? periodStartDate : null,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    }
  } catch (error) {
    console.error('保存收益目标失败:', error)
    const errorMessage = error.message || error.toString() || '未知错误'
    throw new Error(`保存失败: ${errorMessage}`)
  }
}

// 删除收益目标
export async function deleteProfitTarget(objectId) {
  try {
    const target = AV.Object.createWithoutData('ProfitTarget', objectId)
    await target.destroy()
    return true
  } catch (error) {
    console.error('删除收益目标失败:', error)
    throw error
  }
}
