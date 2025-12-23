import * as XLSX from 'xlsx'
import { getRecords, getAdjustments } from './storage'
import { calculateDailyProfitLoss } from './calculations'
import dayjs from 'dayjs'

// 导出为Excel
export async function exportToExcel(startDate = null, endDate = null) {
  try {
    const records = await getRecords()
    const adjustments = await getAdjustments()
    
    if (records.length === 0) {
      throw new Error('没有可导出的数据')
    }
    
    // 排序记录
    const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
    
    // 过滤记录
    let filteredRecords = sortedRecords
    if (startDate || endDate) {
      filteredRecords = sortedRecords.filter(record => {
        if (startDate && record.date < startDate) return false
        if (endDate && record.date > endDate) return false
        return true
      })
    }
    
    // 准备Excel数据
    const excelData = filteredRecords.map((record, index) => {
      // 查找前一条同类型记录
      const sameTypeRecords = sortedRecords.filter(r => r.investmentType === record.investmentType)
      const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date && r.objectId === record.objectId)
      let prevRecord = null
      if (recordIndex > 0) {
        prevRecord = sameTypeRecords[recordIndex - 1]
      }
      
      const dailyProfitLoss = calculateDailyProfitLoss(record, prevRecord, adjustments)
      
      return {
        '日期': record.date,
        '投资类型': record.investmentType === 'stock' ? '股票' : '基金',
        '总资产': record.totalAsset || 0,
        '总市值': record.investmentType === 'stock' ? (record.totalMarketValue || '') : '',
        '上证指数': record.shanghaiIndex || '',
        '当日盈亏': dailyProfitLoss,
        '备注': record.notes || ''
      }
    })
    
    // 创建工作簿
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // 设置列宽
    const colWidths = [
      { wch: 12 }, // 日期
      { wch: 8 },  // 投资类型
      { wch: 15 }, // 总资产
      { wch: 15 }, // 总市值
      { wch: 12 }, // 上证指数
      { wch: 15 }, // 当日盈亏
      { wch: 30 }  // 备注
    ]
    ws['!cols'] = colWidths
    
    // 添加工作表
    XLSX.utils.book_append_sheet(wb, ws, '投资记录')
    
    // 生成文件名
    const fileName = `投资记录_${startDate || '全部'}_${endDate || '全部'}_${dayjs().format('YYYYMMDD')}.xlsx`
    
    // 导出文件
    XLSX.writeFile(wb, fileName)
    
    return fileName
  } catch (error) {
    throw new Error(`导出失败: ${error.message || error.toString()}`)
  }
}

// 导出为CSV
export async function exportToCSV(startDate = null, endDate = null) {
  try {
    const records = await getRecords()
    const adjustments = await getAdjustments()
    
    if (records.length === 0) {
      throw new Error('没有可导出的数据')
    }
    
    // 排序记录
    const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
    
    // 过滤记录
    let filteredRecords = sortedRecords
    if (startDate || endDate) {
      filteredRecords = sortedRecords.filter(record => {
        if (startDate && record.date < startDate) return false
        if (endDate && record.date > endDate) return false
        return true
      })
    }
    
    // CSV表头
    const headers = ['日期', '投资类型', '总资产', '总市值', '上证指数', '当日盈亏', '备注']
    
    // 准备CSV数据
    const csvRows = [headers.join(',')]
    
    filteredRecords.forEach((record) => {
      // 查找前一条同类型记录
      const sameTypeRecords = sortedRecords.filter(r => r.investmentType === record.investmentType)
      const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date && r.objectId === record.objectId)
      let prevRecord = null
      if (recordIndex > 0) {
        prevRecord = sameTypeRecords[recordIndex - 1]
      }
      
      const dailyProfitLoss = calculateDailyProfitLoss(record, prevRecord, adjustments)
      
      const row = [
        record.date,
        record.investmentType === 'stock' ? '股票' : '基金',
        record.totalAsset || 0,
        record.investmentType === 'stock' ? (record.totalMarketValue || '') : '',
        record.shanghaiIndex || '',
        dailyProfitLoss,
        `"${(record.notes || '').replace(/"/g, '""')}"` // 处理CSV中的引号
      ]
      csvRows.push(row.join(','))
    })
    
    // 生成CSV内容
    const csvContent = csvRows.join('\n')
    
    // 创建Blob并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // 添加BOM以支持Excel正确显示中文
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // 生成文件名
    const fileName = `投资记录_${startDate || '全部'}_${endDate || '全部'}_${dayjs().format('YYYYMMDD')}.csv`
    link.download = fileName
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    return fileName
  } catch (error) {
    throw new Error(`导出失败: ${error.message || error.toString()}`)
  }
}

