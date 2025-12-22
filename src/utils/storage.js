import AV from '../config/leancloud'

// 数据表名
const TABLE_NAME = 'MyMoney'

// 获取所有记录
export async function getRecords() {
  try {
    const query = new AV.Query(TABLE_NAME)
    query.ascending('date')
    const results = await query.find()
    
    return results.map(item => ({
      date: item.get('date'),
      totalAsset: item.get('totalAsset'),
      totalMarketValue: item.get('totalMarketValue'),
      investmentType: item.get('investmentType'),
      shanghaiIndex: item.get('shanghaiIndex'),
      notes: item.get('notes'),
      objectId: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
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
    
    const { date, totalAsset, totalMarketValue, investmentType, shanghaiIndex, notes } = record
    
    const query = new AV.Query(TABLE_NAME)
    query.equalTo('date', date)
    const existing = await query.first()
    
    let MoneyRecord
    if (existing) {
      MoneyRecord = AV.Object.createWithoutData(TABLE_NAME, existing.id)
    } else {
      MoneyRecord = new AV.Object(TABLE_NAME)
    }
    
    MoneyRecord.set('date', date)
    MoneyRecord.set('totalAsset', totalAsset)
    if (totalMarketValue !== null && totalMarketValue !== undefined) {
      MoneyRecord.set('totalMarketValue', totalMarketValue)
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
      totalMarketValue,
      investmentType,
      shanghaiIndex,
      notes: notes || '',
      objectId: savedRecord.id
    }
  } catch (error) {
    throw new Error(`保存失败: ${error.message || error.toString()}`)
  }
}

// 删除记录
export async function deleteRecord(date) {
  try {
    const query = new AV.Query(TABLE_NAME)
    query.equalTo('date', date)
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
    
    return results.map(item => ({
      id: item.id,
      date: item.get('date'),
      amount: item.get('amount'),
      notes: item.get('notes'),
      createdAt: item.createdAt
    }))
  } catch (error) {
    return []
  }
}

// 保存加减仓记录
export async function saveAdjustment(adjustment) {
  try {
    const { date, amount, notes } = adjustment
    
    // 删除该日期已有的加减仓记录
    const query = new AV.Query('Adjustment')
    query.equalTo('date', date)
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
    
    await Adjustment.save()
    
    return {
      id: Adjustment.id,
      date,
      amount,
      notes: notes || ''
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

// 删除指定日期的加减仓记录
export async function deleteAdjustmentByDate(date) {
  try {
    const query = new AV.Query('Adjustment')
    query.equalTo('date', date)
    const existing = await query.find()
    if (existing.length > 0) {
      await AV.Object.destroyAll(existing)
    }
    return true
  } catch (error) {
    throw error
  }
}

// 格式化日期
export function formatDate(dateString) {
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
