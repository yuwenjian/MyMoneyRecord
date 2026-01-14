import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getRecords, getAdjustments, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import toast from 'react-hot-toast'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

function CalendarModal({ isOpen, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [dailyData, setDailyData] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadDailyData()
    }
  }, [isOpen, currentMonth])

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

  const handlePrevMonth = () => {
    setCurrentMonth(prev => prev.subtract(1, 'month'))
  }

  const handleNextMonth = () => {
    setCurrentMonth(prev => prev.add(1, 'month'))
  }

  const handleDateClick = (date) => {
    const dateStr = date.format('YYYY-MM-DD')
    if (dailyData[dateStr]) {
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

  // 根据总收益获取背景颜色
  const getBackgroundColor = (totalProfit) => {
    if (totalProfit === 0 || totalProfit === undefined) return ''
    
    const { min, max } = getProfitRange()
    const range = Math.max(Math.abs(min), Math.abs(max))
    
    if (range === 0) return ''
    
    // 归一化到 0-1
    const normalized = totalProfit >= 0 
      ? totalProfit / (max > 0 ? max : 1)
      : Math.abs(totalProfit) / (min < 0 ? Math.abs(min) : 1)
    
    // 限制在 0-1 之间
    const intensity = Math.min(Math.max(normalized, 0), 1)
    
    if (totalProfit >= 0) {
      // 盈利：绿色系，收益越高颜色越深
      const opacity = 0.1 + (intensity * 0.3) // 0.1 到 0.4 的透明度
      return `bg-green-500`
    } else {
      // 亏损：红色系，亏损越多颜色越深
      const opacity = 0.1 + (intensity * 0.3) // 0.1 到 0.4 的透明度
      return `bg-red-500`
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

  const renderCalendar = () => {
    const monthStart = currentMonth.startOf('month')
    const monthEnd = currentMonth.endOf('month')
    const startDate = monthStart.startOf('week')
    const endDate = monthEnd.endOf('week')
    
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
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs sm:text-sm font-semibold text-gray-600 py-1 sm:py-2">
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
                relative p-1 sm:p-2 min-h-[50px] sm:min-h-[60px] border rounded sm:rounded-lg cursor-pointer
                transition-all hover:opacity-80
                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-800'}
                ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
              `}
            >
              <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${isCurrentMonth ? '' : 'opacity-50'}`}>
                {date.date()}
              </div>
              
              {dayData && isCurrentMonth && (
                <div className="space-y-0 sm:space-y-0.5 text-[10px] sm:text-xs leading-tight">
                  {dayData.stockProfit !== 0 && (
                    <div className={`truncate ${dayData.stockProfit >= 0 ? 'text-red-600' : 'text-red-400'}`}>
                      <span className="hidden sm:inline">股: </span>
                      <span className="sm:hidden">股</span>
                      <span className="hidden sm:inline">{formatCurrency(dayData.stockProfit, true)}</span>
                      <span className="sm:hidden">
                        {dayData.stockProfit >= 0 ? '+' : ''}
                        {(dayData.stockProfit / 1000).toFixed(1)}k
                      </span>
                    </div>
                  )}
                  {dayData.fundProfit !== 0 && (
                    <div className={`truncate ${dayData.fundProfit >= 0 ? 'text-blue-600' : 'text-blue-400'}`}>
                      <span className="hidden sm:inline">基: </span>
                      <span className="sm:hidden">基</span>
                      <span className="hidden sm:inline">{formatCurrency(dayData.fundProfit, true)}</span>
                      <span className="sm:hidden">
                        {dayData.fundProfit >= 0 ? '+' : ''}
                        {(dayData.fundProfit / 1000).toFixed(1)}k
                      </span>
                    </div>
                  )}
                  {dayData.totalProfit !== 0 && (
                    <div className={`font-semibold truncate ${dayData.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      <span className="hidden sm:inline">总: </span>
                      <span className="sm:hidden">总</span>
                      <span className="hidden sm:inline">{formatCurrency(dayData.totalProfit, true)}</span>
                      <span className="sm:hidden">
                        {dayData.totalProfit >= 0 ? '+' : ''}
                        {(dayData.totalProfit / 1000).toFixed(1)}k
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-xl shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiChevronLeft size={18} className="sm:w-5 sm:h-5" />
            </button>
            <h2 className="text-base sm:text-xl font-semibold text-gray-800">
              {currentMonth.format('YYYY年MM月')}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiChevronRight size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiX size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>
        
        {/* 日历内容 */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            renderCalendar()
          )}
        </div>
        
        {/* 底部说明 */}
        <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
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
        </div>
      </div>
    </div>
  )
}

export default CalendarModal

