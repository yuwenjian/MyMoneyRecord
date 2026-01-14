import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import localeData from 'dayjs/plugin/localeData'
import 'dayjs/locale/zh-cn'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { PageHeader } from '../components/ui'
import { getRecords, getAdjustments, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import toast from 'react-hot-toast'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(weekOfYear)
dayjs.extend(localeData)
dayjs.locale('zh-cn')

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [currentYear, setCurrentYear] = useState(dayjs())
  const [viewMode, setViewMode] = useState('日') // '日', '月', '年'
  const [dailyData, setDailyData] = useState({})
  const [monthlyData, setMonthlyData] = useState({})
  const [yearlyData, setYearlyData] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    if (viewMode === '日') {
      loadDailyData()
    } else if (viewMode === '月') {
      loadMonthlyData()
    } else if (viewMode === '年') {
      loadYearlyData()
    }
  }, [currentMonth, currentYear, viewMode])

  const loadDailyData = async () => {
    try {
      setIsLoading(true)
      const records = await getRecords()
      const adjustments = await getAdjustments()
      
      const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      
      // 计算当前月份所有日期的收益数据
      const monthStart = currentMonth.startOf('month')
      const monthEnd = currentMonth.endOf('month')
      const data = {}
      
      // 获取当前月份的所有记录
      const monthRecords = sortedRecords.filter(r => {
        const recordDate = dayjs(r.date)
        return recordDate.isSameOrAfter(monthStart, 'day') && 
               recordDate.isSameOrBefore(monthEnd, 'day')
      })
      
      // 按日期分组
      const dateGroups = {}
      monthRecords.forEach(record => {
        if (!dateGroups[record.date]) {
          dateGroups[record.date] = { stock: null, fund: null }
        }
        if (record.investmentType === 'stock') {
          dateGroups[record.date].stock = record
        } else if (record.investmentType === 'fund') {
          dateGroups[record.date].fund = record
        }
      })
      
      // 计算每日收益
      Object.keys(dateGroups).forEach(date => {
        const { stock, fund } = dateGroups[date]
        let stockProfit = 0
        let fundProfit = 0
        
        if (stock) {
          const stockRecords = sortedRecords.filter(r => r.investmentType === 'stock')
          const stockIndex = stockRecords.findIndex(r => r.date === date)
          const prevStockRecord = stockIndex > 0 ? stockRecords[stockIndex - 1] : null
          stockProfit = calculateDailyProfitLoss(stock, prevStockRecord, adjustments)
        }
        
        if (fund) {
          const fundRecords = sortedRecords.filter(r => r.investmentType === 'fund')
          const fundIndex = fundRecords.findIndex(r => r.date === date)
          const prevFundRecord = fundIndex > 0 ? fundRecords[fundIndex - 1] : null
          fundProfit = calculateDailyProfitLoss(fund, prevFundRecord, adjustments)
        }
        
        data[date] = {
          stockProfit,
          fundProfit,
          totalProfit: stockProfit + fundProfit
        }
      })
      
      setDailyData(data)
    } catch (error) {
      console.error('加载日历数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMonthlyData = async () => {
    try {
      setIsLoading(true)
      const records = await getRecords()
      const adjustments = await getAdjustments()
      
      const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      
      // 计算当前年份所有月份的收益数据
      const yearStart = currentYear.startOf('year')
      const yearEnd = currentYear.endOf('year')
      const data = {}
      
      // 获取当前年份的所有记录
      const yearRecords = sortedRecords.filter(r => {
        const recordDate = dayjs(r.date)
        return recordDate.isSameOrAfter(yearStart, 'day') && 
               recordDate.isSameOrBefore(yearEnd, 'day')
      })
      
      // 按月份分组所有记录
      const monthGroups = {}
      yearRecords.forEach(record => {
        const monthKey = dayjs(record.date).format('YYYY-MM')
        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = { stock: [], fund: [] }
        }
        if (record.investmentType === 'stock') {
          monthGroups[monthKey].stock.push(record)
        } else if (record.investmentType === 'fund') {
          monthGroups[monthKey].fund.push(record)
        }
      })
      
      // 计算每月总收益（累加该月所有日期的收益）
      Object.keys(monthGroups).forEach(monthKey => {
        const { stock, fund } = monthGroups[monthKey]
        let stockProfit = 0
        let fundProfit = 0
        
        // 计算股票月总收益
        stock.forEach((record, index) => {
          const stockRecords = sortedRecords.filter(r => r.investmentType === 'stock')
          const stockIndex = stockRecords.findIndex(r => r.date === record.date)
          const prevStockRecord = stockIndex > 0 ? stockRecords[stockIndex - 1] : null
          stockProfit += calculateDailyProfitLoss(record, prevStockRecord, adjustments)
        })
        
        // 计算基金月总收益
        fund.forEach((record, index) => {
          const fundRecords = sortedRecords.filter(r => r.investmentType === 'fund')
          const fundIndex = fundRecords.findIndex(r => r.date === record.date)
          const prevFundRecord = fundIndex > 0 ? fundRecords[fundIndex - 1] : null
          fundProfit += calculateDailyProfitLoss(record, prevFundRecord, adjustments)
        })
        
        data[monthKey] = {
          stockProfit,
          fundProfit,
          totalProfit: stockProfit + fundProfit
        }
      })
      
      setMonthlyData(data)
    } catch (error) {
      console.error('加载月度数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const loadYearlyData = async () => {
    try {
      setIsLoading(true)
      const records = await getRecords()
      const adjustments = await getAdjustments()
      
      const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      
      // 获取所有记录，按年份分组
      const yearGroups = {}
      sortedRecords.forEach(record => {
        const yearKey = dayjs(record.date).format('YYYY')
        if (!yearGroups[yearKey]) {
          yearGroups[yearKey] = { stock: [], fund: [] }
        }
        if (record.investmentType === 'stock') {
          yearGroups[yearKey].stock.push(record)
        } else if (record.investmentType === 'fund') {
          yearGroups[yearKey].fund.push(record)
        }
      })
      
      // 计算每年总收益（累加该年所有日期的收益）
      const data = {}
      Object.keys(yearGroups).forEach(yearKey => {
        const { stock, fund } = yearGroups[yearKey]
        let stockProfit = 0
        let fundProfit = 0
        
        // 计算股票年总收益
        stock.forEach((record, index) => {
          const stockRecords = sortedRecords.filter(r => r.investmentType === 'stock')
          const stockIndex = stockRecords.findIndex(r => r.date === record.date)
          const prevStockRecord = stockIndex > 0 ? stockRecords[stockIndex - 1] : null
          stockProfit += calculateDailyProfitLoss(record, prevStockRecord, adjustments)
        })
        
        // 计算基金年总收益
        fund.forEach((record, index) => {
          const fundRecords = sortedRecords.filter(r => r.investmentType === 'fund')
          const fundIndex = fundRecords.findIndex(r => r.date === record.date)
          const prevFundRecord = fundIndex > 0 ? fundRecords[fundIndex - 1] : null
          fundProfit += calculateDailyProfitLoss(record, prevFundRecord, adjustments)
        })
        
        data[yearKey] = {
          stockProfit,
          fundProfit,
          totalProfit: stockProfit + fundProfit
        }
      })
      
      setYearlyData(data)
    } catch (error) {
      console.error('加载年度数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrevMonth = () => {
    if (viewMode === '日') {
      setCurrentMonth(prev => prev.subtract(1, 'month'))
    } else if (viewMode === '月') {
      setCurrentYear(prev => prev.subtract(1, 'year'))
    }
    // 年视图不需要左右切换，显示所有年份
  }

  const handleNextMonth = () => {
    if (viewMode === '日') {
      setCurrentMonth(prev => prev.add(1, 'month'))
    } else if (viewMode === '月') {
      setCurrentYear(prev => prev.add(1, 'year'))
    }
    // 年视图不需要左右切换，显示所有年份
  }

  const handleDateClick = (date) => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayData = dailyData[dateStr]
    // 如果有数据（即使总收益为0），都可以点击查看详情
    if (dayData) {
      // 切换选中状态
      setSelectedDate(selectedDate === dateStr ? null : dateStr)
    }
  }

  // 计算总收益的最大值和最小值，用于颜色渐变
  const getProfitRange = () => {
    const profits = Object.values(dailyData).map(d => d.totalProfit)
    if (profits.length === 0) return { min: 0, max: 0 }
    return {
      min: Math.min(...profits),
      max: Math.max(...profits)
    }
  }

  // 根据总收益获取背景颜色强度（使用内联样式）
  const getBackgroundStyle = (totalProfit) => {
    if (totalProfit === 0 || totalProfit === undefined) return {}
    
    const { min, max } = getProfitRange()
    const range = Math.max(Math.abs(min), Math.abs(max))
    
    if (range === 0) return {}
    
    // 归一化到 0-1
    const normalized = totalProfit >= 0 
      ? totalProfit / (max > 0 ? max : 1)
      : Math.abs(totalProfit) / (min < 0 ? Math.abs(min) : 1)
    
    // 限制在 0-1 之间
    const intensity = Math.min(Math.max(normalized, 0), 1)
    
    if (totalProfit >= 0) {
      // 盈利：红色系，盈利越多颜色越深
      const opacity = 0.1 + (intensity * 0.3) // 0.1 到 0.4 的透明度
      return { backgroundColor: `rgba(239, 68, 68, ${opacity})` } // red-500
    } else {
      // 亏损：绿色系，亏损越多颜色越深
      const opacity = 0.1 + (intensity * 0.3) // 0.1 到 0.4 的透明度
      return { backgroundColor: `rgba(34, 197, 94, ${opacity})` } // green-500
    }
  }

  const renderMonthView = () => {
    const months = []
    for (let i = 0; i < 12; i++) {
      months.push(currentYear.month(i))
    }
    
    const monthRange = getMonthProfitRange()
    
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
        {months.map(month => {
          const monthKey = month.format('YYYY-MM')
          const monthData = monthlyData[monthKey]
          const bgStyle = monthData ? getMonthBackgroundStyle(monthData.totalProfit, monthRange) : {}
          const isCurrentMonth = month.isSame(dayjs(), 'month')
          
          return (
            <div
              key={monthKey}
              onClick={() => {
                setViewMode('日')
                setCurrentMonth(month)
              }}
              style={bgStyle}
              className={`
                relative p-4 border rounded-lg cursor-pointer
                transition-all hover:opacity-80 flex flex-col items-center justify-center
                min-h-[100px] sm:min-h-[120px]
                ${isCurrentMonth ? 'border-blue-500 border-2' : 'border-gray-200'}
              `}
            >
              <div className="text-sm sm:text-base font-semibold text-gray-800 mb-2">
                {month.format('MM月')}
              </div>
              {monthData && (
                <div className="text-center">
                  <div className={`text-lg sm:text-xl font-bold ${monthData.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(monthData.totalProfit, false)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {monthData.stockProfit !== 0 && (
                      <div>股: {formatCurrency(monthData.stockProfit, false)}</div>
                    )}
                    {monthData.fundProfit !== 0 && (
                      <div>基: {formatCurrency(monthData.fundProfit, false)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const getMonthProfitRange = () => {
    const profits = Object.values(monthlyData).map(d => d.totalProfit)
    if (profits.length === 0) return { min: 0, max: 0 }
    return {
      min: Math.min(...profits),
      max: Math.max(...profits)
    }
  }

  const getMonthBackgroundStyle = (totalProfit, range) => {
    if (totalProfit === 0 || totalProfit === undefined) return {}
    
    const { min, max } = range
    const rangeValue = Math.max(Math.abs(min), Math.abs(max))
    
    if (rangeValue === 0) return {}
    
    const normalized = totalProfit >= 0 
      ? totalProfit / (max > 0 ? max : 1)
      : Math.abs(totalProfit) / (min < 0 ? Math.abs(min) : 1)
    
    const intensity = Math.min(Math.max(normalized, 0), 1)
    
    if (totalProfit >= 0) {
      const opacity = 0.1 + (intensity * 0.3)
      return { backgroundColor: `rgba(239, 68, 68, ${opacity})` }
    } else {
      const opacity = 0.1 + (intensity * 0.3)
      return { backgroundColor: `rgba(34, 197, 94, ${opacity})` }
    }
  }

  const renderYearView = () => {
    const years = Object.keys(yearlyData).sort((a, b) => b.localeCompare(a)) // 降序排列
    
    const yearRange = getYearProfitRange()
    
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
        {years.map(yearKey => {
          const yearData = yearlyData[yearKey]
          const bgStyle = yearData ? getYearBackgroundStyle(yearData.totalProfit, yearRange) : {}
          const isCurrentYear = yearKey === dayjs().format('YYYY')
          
          return (
            <div
              key={yearKey}
              style={bgStyle}
              className={`
                relative p-6 border rounded-lg
                flex flex-col items-center justify-center
                min-h-[120px] sm:min-h-[150px]
                ${isCurrentYear ? 'border-blue-500 border-2' : 'border-gray-200'}
              `}
            >
              <div className="text-lg sm:text-xl font-semibold text-gray-800 mb-3">
                {yearKey}年
              </div>
              {yearData && (
                <div className="text-center">
                  <div className={`text-2xl sm:text-3xl font-bold ${yearData.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(yearData.totalProfit, false)}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {yearData.stockProfit !== 0 && (
                      <div>股票: {formatCurrency(yearData.stockProfit, false)}</div>
                    )}
                    {yearData.fundProfit !== 0 && (
                      <div>基金: {formatCurrency(yearData.fundProfit, false)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const getYearProfitRange = () => {
    const profits = Object.values(yearlyData).map(d => d.totalProfit)
    if (profits.length === 0) return { min: 0, max: 0 }
    return {
      min: Math.min(...profits),
      max: Math.max(...profits)
    }
  }

  const getYearBackgroundStyle = (totalProfit, range) => {
    if (totalProfit === 0 || totalProfit === undefined) return {}
    
    const { min, max } = range
    const rangeValue = Math.max(Math.abs(min), Math.abs(max))
    
    if (rangeValue === 0) return {}
    
    const normalized = totalProfit >= 0 
      ? totalProfit / (max > 0 ? max : 1)
      : Math.abs(totalProfit) / (min < 0 ? Math.abs(min) : 1)
    
    const intensity = Math.min(Math.max(normalized, 0), 1)
    
    if (totalProfit >= 0) {
      const opacity = 0.1 + (intensity * 0.3)
      return { backgroundColor: `rgba(239, 68, 68, ${opacity})` }
    } else {
      const opacity = 0.1 + (intensity * 0.3)
      return { backgroundColor: `rgba(34, 197, 94, ${opacity})` }
    }
  }

  const renderCalendar = () => {
    const monthStart = currentMonth.startOf('month')
    const monthEnd = currentMonth.endOf('month')
    
    // 计算日历开始日期（从本月第一天所在的周日开始）
    // dayjs的day()方法：0=周日, 1=周一, ..., 6=周六
    const firstDayOfMonth = monthStart.day()
    // 计算到本周日的天数差（如果第一天是周日，则回到上周日）
    const daysToSunday = firstDayOfMonth === 0 ? 0 : -firstDayOfMonth
    const startDate = monthStart.add(daysToSunday, 'day')
    
    // 计算日历结束日期（到本月最后一天所在的周六）
    const lastDayOfMonth = monthEnd.day()
    const daysToSaturday = lastDayOfMonth === 6 ? 0 : 6 - lastDayOfMonth
    const endDate = monthEnd.add(daysToSaturday, 'day')
    
    const days = []
    let currentDate = startDate
    
    while (currentDate.isSameOrBefore(endDate, 'day')) {
      days.push(currentDate)
      currentDate = currentDate.add(1, 'day')
    }
    
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    
    return (
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {/* 星期标题 */}
        {weekDays.map((day, index) => (
          <div key={`${day}-${index}`} className="text-center text-xs sm:text-sm font-semibold text-gray-600 py-1 sm:py-2">
            {day}
          </div>
        ))}
        
        {/* 日期单元格 */}
        {days.map(date => {
          const dateStr = date.format('YYYY-MM-DD')
          const isCurrentMonth = date.isSame(currentMonth, 'month')
          const isToday = date.isSame(dayjs(), 'day')
          const dayData = dailyData[dateStr]
          const isSelected = selectedDate === dateStr
          const bgStyle = dayData ? getBackgroundStyle(dayData.totalProfit) : {}
          
          return (
            <div
              key={dateStr}
              onClick={() => handleDateClick(date)}
              style={bgStyle}
              className={`
                relative p-0.5 sm:p-2 min-h-[60px] sm:min-h-[60px] border rounded sm:rounded-lg cursor-pointer
                transition-all hover:opacity-80 flex flex-col
                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-800'}
                ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
              `}
            >
              <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 flex-shrink-0 ${isCurrentMonth ? '' : 'opacity-50'}`}>
                {date.date()}
              </div>
              
              {dayData && isCurrentMonth && (
                <div className="flex-1 flex flex-col justify-center min-h-0">
                  {/* 移动端：只显示总收益 */}
                  <div className={`font-semibold text-[8px] sm:text-xs leading-tight text-center ${dayData.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    <span className="hidden sm:inline">总: </span>
                    <span className="block truncate px-0.5">
                      {formatCurrency(dayData.totalProfit, false)}
                    </span>
                  </div>
                  {/* 桌面端：显示所有收益 */}
                  <div className="hidden sm:block space-y-0.5 text-xs leading-tight">
                    {dayData.stockProfit !== 0 && (
                      <div className={`truncate ${dayData.stockProfit >= 0 ? 'text-red-600' : 'text-red-400'}`}>
                        股: {formatCurrency(dayData.stockProfit, false)}
                      </div>
                    )}
                    {dayData.fundProfit !== 0 && (
                      <div className={`truncate ${dayData.fundProfit >= 0 ? 'text-blue-600' : 'text-blue-400'}`}>
                        基: {formatCurrency(dayData.fundProfit, false)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6 -mx-2 sm:-mx-4 px-2 sm:px-4">
      <PageHeader
        title="日历视图"
        subtitle="查看每日收益情况"
        actions={
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-1 sm:space-x-2 bg-gray-100 rounded-lg p-1">
              {['日', '月', '年'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`
                    px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors
                    ${viewMode === mode 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              {viewMode !== '年' && (
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors flex items-center justify-center"
                  style={{ 
                    width: '44px', 
                    height: '44px',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                  aria-label={viewMode === '月' ? '上一年' : '上一月'}
                >
                  <FiChevronLeft size={18} className="sm:w-5 sm:h-5 text-gray-800" />
                </button>
              )}
              <h2 className="text-base sm:text-xl font-semibold text-gray-800 px-2">
                {viewMode === '日' 
                  ? currentMonth.format('YYYY年MM月')
                  : viewMode === '月'
                  ? currentYear.format('YYYY年')
                  : '所有年份'
                }
              </h2>
              {viewMode !== '年' && (
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors flex items-center justify-center"
                  style={{ 
                    width: '44px', 
                    height: '44px',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                  aria-label={viewMode === '月' ? '下一年' : '下一月'}
                >
                  <FiChevronRight size={18} className="sm:w-5 sm:h-5 text-gray-800" />
                </button>
              )}
            </div>
          </div>
        }
      />

      {/* 日历内容 */}
      <div className="bg-white rounded-xl shadow-sm p-1 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          viewMode === '日' ? renderCalendar() :
          viewMode === '月' ? renderMonthView() :
          renderYearView()
        )}
      </div>
      
      {/* 选中日期的详情显示 */}
      {selectedDate && dailyData[selectedDate] && (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {dayjs(selectedDate).format('YYYY年MM月DD日')} 收益详情
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors flex items-center justify-center"
              style={{ 
                width: '44px', 
                height: '44px',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
              aria-label="关闭"
            >
              <span className="text-xl text-gray-800">×</span>
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium text-gray-700">股票收益</span>
              </div>
              <span className={`text-lg font-semibold ${dailyData[selectedDate].stockProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dailyData[selectedDate].stockProfit, true)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm font-medium text-gray-700">基金收益</span>
              </div>
              <span className={`text-lg font-semibold ${dailyData[selectedDate].fundProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dailyData[selectedDate].fundProfit, true)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-gray-700">总收益</span>
              </div>
              <span className={`text-xl font-bold ${dailyData[selectedDate].totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dailyData[selectedDate].totalProfit, true)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 底部说明 */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-6 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
            <span>股票收益</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500"></div>
            <span>基金收益</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
            <span>总收益</span>
          </div>
        </div>
        <div className="mt-3 text-center text-xs text-gray-500">
          <span className="sm:hidden">点击日期查看详细收益</span>
        </div>
      </div>
    </div>
  )
}

