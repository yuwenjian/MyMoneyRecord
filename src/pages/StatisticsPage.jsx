import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line, Bar, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import DatePicker, { registerLocale } from 'react-datepicker'
import zhCN from 'date-fns/locale/zh-CN'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { getRecords, getAdjustments, formatDate, formatCurrency, saveRecord, deleteRecord } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import { exportToExcel, exportToCSV } from '../utils/export'
import { calculateMonthlyStats, calculateYearlyStats, getAvailablePeriods } from '../utils/periodStats'
import { calculatePeriodStats } from '../utils/timeComparison'
import { aggregateByPeriod, calculateMovingAverage, predictTrend } from '../utils/chartUtils'
import { debounce, throttle } from '../utils/debounce'
import { SkeletonCard, SkeletonChart, SkeletonTable, SkeletonStatCard } from '../components/SkeletonLoader'
import { EmptyState } from '../components/EmptyState'
import { TrendIndicator, PercentTrendIndicator } from '../components/TrendIndicator'
import toast from 'react-hot-toast'
import 'react-datepicker/dist/react-datepicker.css'
import '../styles/StatisticsPage.css'

// 注册中文语言包
registerLocale('zh-CN', zhCN)

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

// 配置 dayjs
dayjs.extend(customParseFormat)
dayjs.locale('zh-cn')

function StatisticsPage() {
  const navigate = useNavigate()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 自定义输入组件，防止手机端弹出键盘
  const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
    <input
      value={value}
      onClick={onClick}
      ref={ref}
      readOnly
      className="new-picker-input"
    />
  ));

  const [stats, setStats] = useState({
    currentStockAsset: '--',
    currentFundAsset: '--',
    stockProfitLoss: '--',
    fundProfitLoss: '--',
    totalProfitLoss: '--'
  })
  const [chartData, setChartData] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all') // 'all', 'stock', 'fund'
  const [editingRecord, setEditingRecord] = useState(null) // 正在编辑的记录
  const [selectedRecords, setSelectedRecords] = useState([]) // 选中的记录（用于批量删除）
  const [periodView, setPeriodView] = useState('month') // 'month' or 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(null) // 选中的周期
  const [periodStats, setPeriodStats] = useState(null) // 周期统计
  const [availablePeriods, setAvailablePeriods] = useState({ months: [], years: [] })
  const [timeComparison, setTimeComparison] = useState({
    period1Start: '',
    period1End: '',
    period2Start: '',
    period2End: '',
    showComparison: false
  })
  const [comparisonResult, setComparisonResult] = useState(null)
  const [chartType, setChartType] = useState('line') // 'line', 'bar', 'pie'
  const [chartPeriod, setChartPeriod] = useState('day') // 'day', 'week', 'month', 'year'
  const [showMovingAverage, setShowMovingAverage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isChartCollapsed, setIsChartCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 600
    }
    return false
  })

  useEffect(() => {
    const initDates = async () => {
      const records = await getRecords()
      if (records.length > 0) {
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
        const firstDate = sortedRecords[0].date
        const lastDate = sortedRecords[sortedRecords.length - 1].date
        
        setStartDate(firstDate)
        setEndDate(lastDate)
      } else {
        // 如果没有记录，设置默认日期为今天
        const today = dayjs().format('YYYY-MM-DD')
        setStartDate(today)
        setEndDate(today)
      }
    }

    initDates()
  }, [])

  // 防抖版本的loadStatistics
  const debouncedLoadStatistics = React.useMemo(
    () => debounce(() => {
      loadStatistics()
    }, 300),
    []
  )

  useEffect(() => {
    if (startDate && endDate) {
      debouncedLoadStatistics()
    }
    loadPeriodStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, periodView, selectedPeriod, chartType, chartPeriod, showMovingAverage, historyFilter])

  // 监听窗口大小变化（节流）
  useEffect(() => {
    const handleResize = throttle(() => {
      setIsMobile(window.innerWidth <= 600)
    }, 200)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 加载周期统计
  const loadPeriodStats = async () => {
    try {
      const records = await getRecords()
      const adjustments = await getAdjustments()

      if (records.length === 0) {
        setPeriodStats(null)
        setAvailablePeriods({ months: [], years: [] })
        return
      }

      const periods = getAvailablePeriods(records)
      setAvailablePeriods(periods)

      // 如果没有选择周期，默认选择最新的
      if (!selectedPeriod) {
        if (periodView === 'month' && periods.months.length > 0) {
          setSelectedPeriod(periods.months[periods.months.length - 1])
          return
        } else if (periodView === 'year' && periods.years.length > 0) {
          setSelectedPeriod(periods.years[0].toString())
          return
        }
      }

      if (!selectedPeriod) {
        setPeriodStats(null)
        return
      }

      let stats = null
      if (periodView === 'month' && selectedPeriod) {
        const [year, month] = selectedPeriod.split('-').map(Number)
        stats = calculateMonthlyStats(records, adjustments, year, month)
      } else if (periodView === 'year' && selectedPeriod) {
        stats = calculateYearlyStats(records, adjustments, parseInt(selectedPeriod))
      }

      setPeriodStats(stats)
    } catch (error) {
      console.error('加载周期统计失败:', error)
      setPeriodStats(null)
      toast.error('加载周期统计失败')
    }
  }

  const loadStatistics = async () => {
    setIsLoading(true)
    try {
      const records = await getRecords()
      const adjustments = await getAdjustments()

      if (records.length === 0) {
        setStats({
          currentStockAsset: formatCurrency(0),
          currentFundAsset: formatCurrency(0),
          stockProfitLoss: formatCurrency(0, true),
          fundProfitLoss: formatCurrency(0, true),
          totalProfitLoss: formatCurrency(0, true)
        })
        setChartData(null)
        setHistoryData([])
        setIsLoading(false)
        return
      }

    const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
    
    // 过滤记录
    let filteredRecords = sortedRecords
    if (startDate || endDate) {
      filteredRecords = sortedRecords.filter(record => {
        if (startDate && record.date < startDate) return false
        if (endDate && record.date > endDate) return false
        return true
      })
    }

    // 获取当前账户总资产（按日期排序后取最新的）
    const stockRecords = sortedRecords
      .filter(r => r.investmentType === 'stock')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    const fundRecords = sortedRecords
      .filter(r => r.investmentType === 'fund')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    
    const currentStockAsset = stockRecords.length > 0 
      ? (stockRecords[stockRecords.length - 1].totalAsset || 0) 
      : 0
    const currentFundAsset = fundRecords.length > 0 
      ? (fundRecords[fundRecords.length - 1].totalAsset || 0) 
      : 0

    // 计算盈亏
    let stockProfitLoss = 0
    let fundProfitLoss = 0

    filteredRecords.forEach((record) => {
      // 查找相同投资类型的前一条记录（日期小于当前记录日期）
      // 先按日期排序同类型记录
      const sameTypeRecords = sortedRecords
        .filter(r => r.investmentType === record.investmentType)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      let actualPrevRecord = null
      
      // 找到当前记录在同类型记录中的位置
      const recordIndex = sameTypeRecords.findIndex(r => 
        r.date === record.date && r.objectId === record.objectId
      )
      
      if (recordIndex > 0) {
        // 查找前一条同类型记录（日期小于当前记录日期）
        actualPrevRecord = sameTypeRecords[recordIndex - 1]
      } else if (recordIndex === -1) {
        // 如果找不到当前记录（可能因为过滤），查找日期小于当前记录日期的最近一条同类型记录
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(record.date), 'day')) {
            actualPrevRecord = sameTypeRecords[i]
            break
          }
        }
      } else if (recordIndex === 0) {
        // 如果是第一条记录，查找日期小于当前记录日期的最近一条同类型记录（可能在过滤范围外）
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(record.date), 'day')) {
            actualPrevRecord = sameTypeRecords[i]
            break
          }
        }
      }

      const dailyProfitLoss = calculateDailyProfitLoss(record, actualPrevRecord, adjustments)

      if (record.investmentType === 'stock') {
        stockProfitLoss += dailyProfitLoss
      } else if (record.investmentType === 'fund') {
        fundProfitLoss += dailyProfitLoss
      }
    })

    const totalProfitLoss = stockProfitLoss + fundProfitLoss

    setStats({
      currentStockAsset: formatCurrency(currentStockAsset),
      currentFundAsset: formatCurrency(currentFundAsset),
      stockProfitLoss: formatCurrency(stockProfitLoss, true),
      fundProfitLoss: formatCurrency(fundProfitLoss, true),
      totalProfitLoss: formatCurrency(totalProfitLoss, true)
    })

    // 更新图表
    updateChart(filteredRecords, sortedRecords, adjustments)
    
    // 更新历史记录
    updateHistoryTable(filteredRecords, sortedRecords, adjustments)
    } catch (error) {
      console.error('加载统计数据失败:', error)
      toast.error('加载数据失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const updateChart = (filteredRecords, allRecords, adjustments) => {
    if (filteredRecords.length === 0) {
      setChartData(null)
      return
    }

    // 按周期聚合数据
    let processedRecords = aggregateByPeriod(filteredRecords, chartPeriod)
    const sortedFiltered = [...processedRecords].sort((a, b) => new Date(a.date) - new Date(b.date))
    const firstStockRecord = sortedFiltered.find(r => r.investmentType === 'stock')
    const firstFundRecord = sortedFiltered.find(r => r.investmentType === 'fund')
    const initialStockAsset = firstStockRecord ? (firstStockRecord.totalAsset || 1) : 1
    const initialFundAsset = firstFundRecord ? (firstFundRecord.totalAsset || 1) : 1
    const firstIndexRecord = sortedFiltered.find(r => r.shanghaiIndex)
    const initialIndex = firstIndexRecord ? (firstIndexRecord.shanghaiIndex || 1) : 1

    const labels = []
    const stockCumulativeProfit = []
    const fundCumulativeProfit = []
    const indexData = []
    const stockDailyProfit = []
    const fundDailyProfit = []

    // 计算每日盈亏（使用原始allRecords来计算，但按周期显示）
    sortedFiltered.forEach((record) => {
      // 根据周期格式化标签
      let labelText = ''
      if (chartPeriod === 'day') {
        labelText = formatDate(record.date)
      } else if (chartPeriod === 'week') {
        const date = dayjs(record.date)
        labelText = `${date.format('YYYY-MM-DD')}周`
      } else if (chartPeriod === 'month') {
        const date = dayjs(record.date)
        labelText = date.format('YYYY年MM月')
      } else if (chartPeriod === 'year') {
        const date = dayjs(record.date)
        labelText = date.format('YYYY年')
      }
      labels.push(labelText)

      // 先按日期排序同类型记录
      const sameTypeRecords = allRecords
        .filter(r => r.investmentType === record.investmentType)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      const recordIndex = sameTypeRecords.findIndex(r => 
        r.date === record.date && r.objectId === record.objectId
      )
      
      let prevRecord = null
      if (recordIndex > 0) {
        prevRecord = sameTypeRecords[recordIndex - 1]
      } else if (recordIndex === 0) {
        // 如果是第一条记录，查找日期小于当前记录日期的最近一条同类型记录
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(record.date), 'day')) {
            prevRecord = sameTypeRecords[i]
            break
          }
        }
      }
      
      const dailyProfitLoss = calculateDailyProfitLoss(record, prevRecord, adjustments)

      if (record.investmentType === 'stock') {
        const currentStockAsset = record.totalAsset || 0
        const stockPercent = ((currentStockAsset - initialStockAsset) / initialStockAsset) * 100
        stockCumulativeProfit.push(stockPercent)
        stockDailyProfit.push(dailyProfitLoss)
        fundCumulativeProfit.push(null)
        fundDailyProfit.push(null)
      } else {
        const currentFundAsset = record.totalAsset || 0
        const fundPercent = ((currentFundAsset - initialFundAsset) / initialFundAsset) * 100
        stockCumulativeProfit.push(null)
        stockDailyProfit.push(null)
        fundCumulativeProfit.push(fundPercent)
        fundDailyProfit.push(dailyProfitLoss)
      }

      if (record.shanghaiIndex) {
        const indexPercent = ((record.shanghaiIndex - initialIndex) / initialIndex) * 100
        indexData.push(indexPercent)
      } else {
        indexData.push(null)
      }
    })

    // 根据图表类型生成不同的数据
    if (chartType === 'pie') {
      // 饼图：显示总盈亏占比
      const stockTotal = stockDailyProfit.filter(v => v !== null).reduce((sum, v) => sum + v, 0)
      const fundTotal = fundDailyProfit.filter(v => v !== null).reduce((sum, v) => sum + v, 0)
      const total = stockTotal + fundTotal
      
      setChartData({
        labels: ['股票', '基金'],
        datasets: [{
          label: '盈亏占比',
          data: [Math.abs(stockTotal), Math.abs(fundTotal)],
          backgroundColor: [
            'rgba(231, 76, 60, 0.8)',
            'rgba(80, 200, 120, 0.8)'
          ],
          borderColor: [
            'rgb(231, 76, 60)',
            'rgb(80, 200, 120)'
          ],
          borderWidth: 2
        }]
      })
    } else {
      // 折线图和柱状图使用相同的数据结构
      const datasets = [
        {
          label: '指数趋势',
          data: indexData,
          borderColor: 'rgb(150, 150, 150)',
          backgroundColor: 'rgba(150, 150, 150, 0.1)',
          tension: chartType === 'line' ? 0.1 : 0,
          spanGaps: true
        },
        {
          label: '股票收益',
          data: stockCumulativeProfit,
          borderColor: 'rgb(231, 76, 60)',
          backgroundColor: chartType === 'bar' ? 'rgba(231, 76, 60, 0.6)' : 'rgba(231, 76, 60, 0.1)',
          tension: chartType === 'line' ? 0.1 : 0,
          spanGaps: true
        },
        {
          label: '基金收益',
          data: fundCumulativeProfit,
          borderColor: 'rgb(80, 200, 120)',
          backgroundColor: chartType === 'bar' ? 'rgba(80, 200, 120, 0.6)' : 'rgba(80, 200, 120, 0.1)',
          tension: chartType === 'line' ? 0.1 : 0,
          spanGaps: true
        }
      ]

      // 添加移动平均线
      if (showMovingAverage && chartType === 'line') {
        const stockMA = calculateMovingAverage(stockCumulativeProfit, 5)
        const fundMA = calculateMovingAverage(fundCumulativeProfit, 5)
        
        datasets.push({
          label: '股票移动平均(5期)',
          data: stockMA,
          borderColor: 'rgba(231, 76, 60, 0.5)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.1,
          spanGaps: true,
          pointRadius: 0
        })
        
        datasets.push({
          label: '基金移动平均(5期)',
          data: fundMA,
          borderColor: 'rgba(80, 200, 120, 0.5)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.1,
          spanGaps: true,
          pointRadius: 0
        })
      }

      // 添加趋势预测
      const stockPredictions = predictTrend(stockCumulativeProfit, 3)
      const fundPredictions = predictTrend(fundCumulativeProfit, 3)
      
      if (stockPredictions.length > 0 || fundPredictions.length > 0) {
        const extendedLabels = [...labels]
        for (let i = 1; i <= 3; i++) {
          extendedLabels.push(`预测${i}`)
        }
        
        const stockWithPrediction = [...stockCumulativeProfit, ...stockPredictions]
        const fundWithPrediction = [...fundCumulativeProfit, ...fundPredictions]
        
        datasets.push({
          label: '股票趋势预测',
          data: stockWithPrediction,
          borderColor: 'rgba(231, 76, 60, 0.3)',
          backgroundColor: 'transparent',
          borderDash: [10, 5],
          tension: 0.1,
          spanGaps: true,
          pointRadius: 0
        })
        
        datasets.push({
          label: '基金趋势预测',
          data: fundWithPrediction,
          borderColor: 'rgba(80, 200, 120, 0.3)',
          backgroundColor: 'transparent',
          borderDash: [10, 5],
          tension: 0.1,
          spanGaps: true,
          pointRadius: 0
        })
        
        setChartData({
          labels: extendedLabels,
          datasets
        })
      } else {
        setChartData({
          labels,
          datasets
        })
      }
    }
  }

  const updateHistoryTable = (filteredRecords, allRecords, adjustments) => {
    const sortedFilteredRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date))
    
    const history = sortedFilteredRecords.map((record) => {
      // 查找相同投资类型的前一条记录（日期小于当前记录日期）
      // 先按日期排序同类型记录
      const sameTypeRecords = allRecords
        .filter(r => r.investmentType === record.investmentType)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      let actualPrevRecord = null
      
      // 找到当前记录在同类型记录中的位置
      const recordIndex = sameTypeRecords.findIndex(r => 
        r.date === record.date && r.objectId === record.objectId
      )
      
      if (recordIndex > 0) {
        // 查找前一条同类型记录（日期小于当前记录日期）
        actualPrevRecord = sameTypeRecords[recordIndex - 1]
      } else if (recordIndex === -1) {
        // 如果找不到当前记录，查找日期小于当前记录日期的最近一条同类型记录
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(record.date), 'day')) {
            actualPrevRecord = sameTypeRecords[i]
            break
          }
        }
      } else if (recordIndex === 0) {
        // 如果是第一条记录，查找日期小于当前记录日期的最近一条同类型记录（可能在过滤范围外）
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(record.date), 'day')) {
            actualPrevRecord = sameTypeRecords[i]
            break
          }
        }
      }

      const dailyProfitLoss = calculateDailyProfitLoss(record, actualPrevRecord, adjustments)
      
      // 获取当天的加减仓金额
      const dayAdjustment = adjustments
        .filter(a => a.date === record.date && a.investmentType === record.investmentType)
        .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
      
      return {
        // 显示用的格式化数据
        date: formatDate(record.date),
        type: record.investmentType === 'stock' ? '股票' : '基金',
        totalAsset: formatCurrency(record.totalAsset || 0),
        totalMarketValue: record.totalMarketValue ? formatCurrency(record.totalMarketValue) : '--',
        shanghaiIndex: record.shanghaiIndex ? record.shanghaiIndex.toFixed(2) : '--',
        dailyProfitLoss: formatCurrency(dailyProfitLoss, true),
        profitClass: dailyProfitLoss >= 0 ? 'profit-positive' : 'profit-negative',
        adjustmentAmount: dayAdjustment !== 0 ? formatCurrency(dayAdjustment, true) : '--',
        adjustmentClass: dayAdjustment > 0 ? 'adjustment-add' : dayAdjustment < 0 ? 'adjustment-reduce' : '',
        notes: record.notes || '--',
        // 保存原始数据用于编辑和删除
        originalData: {
          date: record.date,
          investmentType: record.investmentType,
          totalAsset: record.totalAsset,
          totalMarketValue: record.totalMarketValue,
          shanghaiIndex: record.shanghaiIndex,
          notes: record.notes,
          objectId: record.objectId
        }
      }
    })

    setHistoryData(history)
  }

  const handleReset = async () => {
    const records = await getRecords()
    if (records.length > 0) {
      const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
      const firstDate = sortedRecords[0].date
      const lastDate = sortedRecords[sortedRecords.length - 1].date
      
      setStartDate(firstDate)
      setEndDate(lastDate)
    }
  }

  // 编辑记录
  const handleEditRecord = (item) => {
    setEditingRecord(item.originalData)
  }

  // 保存编辑
  const handleSaveEdit = async (editedData) => {
    try {
      const loadingToast = toast.loading('正在保存...')
      await saveRecord(editedData)
      toast.success('记录已更新', { id: loadingToast })
      setEditingRecord(null)
      // 重新加载数据
      await loadStatistics()
    } catch (error) {
      toast.error(`更新失败: ${error.message || error.toString()}`)
    }
  }

  // 删除单条记录
  const handleDeleteRecord = async (item) => {
    if (!window.confirm(`确定要删除 ${item.date} 的${item.type}记录吗？`)) {
      return
    }
    
    try {
      const loadingToast = toast.loading('正在删除...')
      const original = item.originalData
      await deleteRecord(original.date, original.investmentType)
      toast.success('记录已删除', { id: loadingToast })
      // 重新加载数据
      await loadStatistics()
    } catch (error) {
      toast.error(`删除失败: ${error.message || error.toString()}`)
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRecords.length === 0) {
      toast.error('请先选择要删除的记录')
      return
    }
    
    if (!window.confirm(`确定要删除选中的 ${selectedRecords.length} 条记录吗？`)) {
      return
    }
    
    try {
      const loadingToast = toast.loading('正在删除...')
      const deletePromises = selectedRecords.map(item => {
        const original = item.originalData
        return deleteRecord(original.date, original.investmentType)
      })
      await Promise.all(deletePromises)
      toast.success(`已删除 ${selectedRecords.length} 条记录`, { id: loadingToast })
      setSelectedRecords([])
      // 重新加载数据
      await loadStatistics()
    } catch (error) {
      toast.error(`删除失败: ${error.message || error.toString()}`)
    }
  }

  // 切换记录选中状态
  const toggleRecordSelection = (item) => {
    setSelectedRecords(prev => {
      const exists = prev.find(r => r.originalData.objectId === item.originalData.objectId)
      if (exists) {
        return prev.filter(r => r.originalData.objectId !== item.originalData.objectId)
      } else {
        return [...prev, item]
      }
    })
  }

  // 导出数据
  const handleExport = async (format) => {
    try {
      const loadingToast = toast.loading('正在导出...')
      let fileName
      if (format === 'excel') {
        fileName = await exportToExcel(startDate, endDate)
        toast.success(`已导出为Excel: ${fileName}`, { id: loadingToast, duration: 3000 })
      } else if (format === 'csv') {
        fileName = await exportToCSV(startDate, endDate)
        toast.success(`已导出为CSV: ${fileName}`, { id: loadingToast, duration: 3000 })
      }
    } catch (error) {
      toast.error(error.message || '导出失败')
    }
  }

  // 时间段对比分析
  const handleTimeComparison = async () => {
    const { period1Start, period1End, period2Start, period2End } = timeComparison
    
    if (!period1Start || !period1End || !period2Start || !period2End) {
      toast.error('请填写完整的时间段')
      return
    }

    try {
      const records = await getRecords()
      const adjustments = await getAdjustments()
      
      const period1Stats = calculatePeriodStats(records, adjustments, period1Start, period1End)
      const period2Stats = calculatePeriodStats(records, adjustments, period2Start, period2End)
      
      if (!period1Stats || !period2Stats) {
        toast.error('所选时间段没有数据')
        return
      }

      setComparisonResult({
        period1: period1Stats,
        period2: period2Stats
      })
      setTimeComparison(prev => ({ ...prev, showComparison: true }))
    } catch (error) {
      toast.error(error.message || '对比分析失败')
    }
  }

  const handleStartDateChange = (date, dateString) => {
    if (dateString) {
      setStartDate(dateString)
    }
  }

  const handleEndDateChange = (date, dateString) => {
    if (dateString) {
      setEndDate(dateString)
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && chartData) {
        const element = elements[0]
        const datasetIndex = element.datasetIndex
        const index = element.index
        const dataset = chartData.datasets[datasetIndex]
        const label = chartData.labels[index]
        const value = dataset.data[index]
        
        if (value !== null && value !== undefined) {
          toast.success(`${label}: ${dataset.label} = ${value.toFixed(2)}%`, { duration: 2000 })
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || ''
            if (label) {
              label += ': '
            }
            if (context.parsed.y !== null) {
              const percent = context.parsed.y
              label += percent.toFixed(2) + '%'
            }
            return label
          }
        }
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '日期'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: '盈亏百分比（%）'
        },
        ticks: {
          callback: function(value) {
            return value.toFixed(2) + '%'
          }
        }
      }
    }
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event, elements) => {
      if (elements.length > 0 && chartData) {
        const element = elements[0]
        const index = element.index
        const label = chartData.labels[index]
        const value = chartData.datasets[0].data[index]
        const total = chartData.datasets[0].data.reduce((sum, v) => sum + v, 0)
        const percentage = (value / total * 100).toFixed(1)
        
        toast.success(`${label}: ${value.toFixed(2)} (${percentage}%)`, { duration: 2000 })
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'right',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || ''
            const value = context.parsed
            const total = context.dataset.data.reduce((sum, v) => sum + v, 0)
            const percentage = ((value / total) * 100).toFixed(1)
            return `${label}: ${value.toFixed(2)} (${percentage}%)`
          }
        }
      }
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <button className="back-icon-btn" onClick={() => navigate('/')}>‹</button>
        <h1>统计分析</h1>
      </header>

      <main className="app-main">
        <div className="statistics-container">
          {/* 日期范围选择 */}
          <div className="stats-card">
            <h2 className="stats-title">日期范围</h2>
            <div className="date-range-wrapper">
              <div className="date-range-item">
                <label className="form-label">开始日期</label>
                <DatePicker
                  selected={startDate ? dayjs(startDate).toDate() : null}
                  onChange={(date) => setStartDate(dayjs(date).format('YYYY-MM-DD'))}
                  dateFormat={isMobile ? "MM/dd" : "yyyy年MM月dd日"}
                  locale="zh-CN"
                  customInput={<CustomInput />}
                  wrapperClassName="new-picker-wrapper"
                />
              </div>
              <div className="date-range-item">
                <label className="form-label">结束日期</label>
                <DatePicker
                  selected={endDate ? dayjs(endDate).toDate() : null}
                  onChange={(date) => setEndDate(dayjs(date).format('YYYY-MM-DD'))}
                  dateFormat={isMobile ? "MM/dd" : "yyyy年MM月dd日"}
                  locale="zh-CN"
                  customInput={<CustomInput />}
                  wrapperClassName="new-picker-wrapper"
                />
              </div>
              <div className="date-range-buttons">
                <button className="filter-btn-stat" onClick={loadStatistics}>筛选</button>
                <button
                  className="filter-btn-stat reset-btn"
                  onClick={handleReset}
                >
                  重置
                </button>
              </div>
            </div>
          </div>

          {/* 仪表盘 */}
          {isLoading ? (
            <div className="dashboard-section">
              <SkeletonStatCard />
              <SkeletonStatCard />
            </div>
          ) : (
            <div className="dashboard-section">
              <div className="dashboard-card total-asset-card">
                <div className="dashboard-icon">💰</div>
                <div className="dashboard-content">
                  <div className="dashboard-label">总资产</div>
                  <div className="dashboard-value">
                    {(() => {
                      const stock = parseFloat(stats.currentStockAsset.replace(/,/g, '')) || 0
                      const fund = parseFloat(stats.currentFundAsset.replace(/,/g, '')) || 0
                      return formatCurrency(stock + fund)
                    })()}
                  </div>
                </div>
              </div>
              
              <div className="dashboard-card today-profit-card">
                <div className="dashboard-icon">📊</div>
                <div className="dashboard-content">
                  <div className="dashboard-label">今日盈亏</div>
                  <div className={`dashboard-value ${(() => {
                    const total = parseFloat(stats.totalProfitLoss.replace(/,/g, '')) || 0
                    return total >= 0 ? 'positive' : 'negative'
                  })()}`}>
                    <TrendIndicator 
                      value={stats.totalProfitLoss} 
                      showArrow={true} 
                      showSign={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 持仓分布 */}
          <div className="stats-card">
            <h2 className="stats-title">持仓分布</h2>
            <div className="position-distribution">
              {(() => {
                const stock = parseFloat(stats.currentStockAsset.replace(/,/g, '')) || 0
                const fund = parseFloat(stats.currentFundAsset.replace(/,/g, '')) || 0
                const total = stock + fund
                const stockRatio = total > 0 ? (stock / total * 100) : 0
                const fundRatio = total > 0 ? (fund / total * 100) : 0
                
                return (
                  <>
                    <div className="distribution-item">
                      <div className="distribution-header">
                        <span className="distribution-label">股票</span>
                        <span className="distribution-percent">{stockRatio.toFixed(1)}%</span>
                      </div>
                      <div className="distribution-bar">
                        <div 
                          className="distribution-bar-fill stock-fill" 
                          style={{ width: `${stockRatio}%` }}
                        ></div>
                      </div>
                      <div className="distribution-value">{stats.currentStockAsset}</div>
                    </div>
                    <div className="distribution-item">
                      <div className="distribution-header">
                        <span className="distribution-label">基金</span>
                        <span className="distribution-percent">{fundRatio.toFixed(1)}%</span>
                      </div>
                      <div className="distribution-bar">
                        <div 
                          className="distribution-bar-fill fund-fill" 
                          style={{ width: `${fundRatio}%` }}
                        ></div>
                      </div>
                      <div className="distribution-value">{stats.currentFundAsset}</div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* 账户资产统计 */}
          <div className="stats-card">
            <h2 className="stats-title">账户资产</h2>
            <div className="stat-item">
              <span className="stat-label">当前股票账户总资产</span>
              <span className="stat-value">{stats.currentStockAsset}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">当前基金账户总资产</span>
              <span className="stat-value">{stats.currentFundAsset}</span>
            </div>
          </div>

          {/* 盈亏统计 */}
          <div className="stats-card">
            <h2 className="stats-title">盈亏统计 ({startDate} 至 {endDate})</h2>
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <>
                <div className="stat-item">
                  <span className="stat-label">股票盈亏资金</span>
                  <span className="stat-value">
                    <TrendIndicator 
                      value={stats.stockProfitLoss} 
                      showArrow={true} 
                      showSign={true}
                    />
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">基金盈亏资金</span>
                  <span className="stat-value">
                    <TrendIndicator 
                      value={stats.fundProfitLoss} 
                      showArrow={true} 
                      showSign={true}
                    />
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">总盈亏</span>
                  <span className="stat-value">
                    <TrendIndicator 
                      value={stats.totalProfitLoss} 
                      showArrow={true} 
                      showSign={false}
                    />
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 月度/年度汇总统计 */}
          <div className="stats-card">
            <div className="stats-header-with-action">
              <h2 className="stats-title">周期汇总统计</h2>
              <div className="period-view-toggle">
                <button
                  className={`period-toggle-btn ${periodView === 'month' ? 'active' : ''}`}
                  onClick={() => {
                    setPeriodView('month')
                    setSelectedPeriod(null)
                  }}
                >
                  月度
                </button>
                <button
                  className={`period-toggle-btn ${periodView === 'year' ? 'active' : ''}`}
                  onClick={() => {
                    setPeriodView('year')
                    setSelectedPeriod(null)
                  }}
                >
                  年度
                </button>
              </div>
            </div>
            
            {/* 周期选择器 */}
            <div className="period-selector">
              {periodView === 'month' ? (
                <select
                  className="period-select"
                  value={selectedPeriod || ''}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">请选择月份</option>
                  {availablePeriods.months.map(month => {
                    const [year, mon] = month.split('-')
                    return (
                      <option key={month} value={month}>
                        {year}年{mon}月
                      </option>
                    )
                  })}
                </select>
              ) : (
                <select
                  className="period-select"
                  value={selectedPeriod || ''}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">请选择年份</option>
                  {availablePeriods.years.map(year => (
                    <option key={year} value={year.toString()}>
                      {year}年
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 统计结果 */}
            {periodStats && (
              <div className="period-stats-content">
                <div className="period-stats-section">
                  <h3 className="period-stats-subtitle">股票统计</h3>
                  <div className="stat-item">
                    <span className="stat-label">盈亏金额</span>
                    <span className={`stat-value ${periodStats.stock.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(periodStats.stock.profitLoss, true)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">收益率</span>
                    <span className={`stat-value ${periodStats.stock.returnRate >= 0 ? 'positive' : 'negative'}`}>
                      {periodStats.stock.returnRate.toFixed(2)}%
                    </span>
                  </div>
                  {periodView === 'year' && (
                    <div className="stat-item">
                      <span className="stat-label">年化收益率</span>
                      <span className={`stat-value ${(periodStats.stock.annualizedReturn * 100) >= 0 ? 'positive' : 'negative'}`}>
                        {(periodStats.stock.annualizedReturn * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  <div className="stat-item">
                    <span className="stat-label">胜率</span>
                    <span className="stat-value">
                      {periodStats.stock.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">最大回撤</span>
                    <span className="stat-value negative">
                      {periodStats.stock.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">交易天数</span>
                    <span className="stat-value">
                      {periodStats.stock.days} 天
                    </span>
                  </div>
                </div>

                <div className="period-stats-section">
                  <h3 className="period-stats-subtitle">基金统计</h3>
                  <div className="stat-item">
                    <span className="stat-label">盈亏金额</span>
                    <span className={`stat-value ${periodStats.fund.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(periodStats.fund.profitLoss, true)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">收益率</span>
                    <span className={`stat-value ${periodStats.fund.returnRate >= 0 ? 'positive' : 'negative'}`}>
                      {periodStats.fund.returnRate.toFixed(2)}%
                    </span>
                  </div>
                  {periodView === 'year' && (
                    <div className="stat-item">
                      <span className="stat-label">年化收益率</span>
                      <span className={`stat-value ${(periodStats.fund.annualizedReturn * 100) >= 0 ? 'positive' : 'negative'}`}>
                        {(periodStats.fund.annualizedReturn * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  <div className="stat-item">
                    <span className="stat-label">胜率</span>
                    <span className="stat-value">
                      {periodStats.fund.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">最大回撤</span>
                    <span className="stat-value negative">
                      {periodStats.fund.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">交易天数</span>
                    <span className="stat-value">
                      {periodStats.fund.days} 天
                    </span>
                  </div>
                </div>

                <div className="period-stats-section">
                  <h3 className="period-stats-subtitle">合计统计</h3>
                  <div className="stat-item">
                    <span className="stat-label">总盈亏</span>
                    <span className={`stat-value ${periodStats.total.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(periodStats.total.profitLoss, true)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!periodStats && selectedPeriod && (
              <div className="empty-state" style={{ padding: '20px', textAlign: 'center' }}>
                该周期暂无数据
              </div>
            )}
          </div>

          {/* 股票与基金收益对比分析 */}
          <div className="stats-card">
            <h2 className="stats-title">股票与基金收益对比 ({startDate} 至 {endDate})</h2>
            <div className="comparison-stats-grid">
              <div className="comparison-item stock-comparison">
                <div className="comparison-header">
                  <span className="comparison-icon">📈</span>
                  <span className="comparison-title">股票</span>
                </div>
                <div className="comparison-content">
                  <div className="comparison-stat">
                    <span className="comparison-label">累计盈亏</span>
                    <span className={`comparison-value ${parseFloat(stats.stockProfitLoss.replace(/,/g, '')) >= 0 ? 'positive' : 'negative'}`}>
                      {stats.stockProfitLoss}
                    </span>
                  </div>
                  <div className="comparison-stat">
                    <span className="comparison-label">当前资产</span>
                    <span className="comparison-value">{stats.currentStockAsset}</span>
                  </div>
                  {(() => {
                    const stockProfit = parseFloat(stats.stockProfitLoss.replace(/,/g, ''))
                    const fundProfit = parseFloat(stats.fundProfitLoss.replace(/,/g, ''))
                    const totalProfit = stockProfit + fundProfit
                    const stockRatio = totalProfit !== 0 ? (stockProfit / totalProfit * 100) : 0
                    return (
                      <div className="comparison-stat">
                        <span className="comparison-label">占比</span>
                        <span className="comparison-value">{stockRatio.toFixed(1)}%</span>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <div className="comparison-item fund-comparison">
                <div className="comparison-header">
                  <span className="comparison-icon">📊</span>
                  <span className="comparison-title">基金</span>
                </div>
                <div className="comparison-content">
                  <div className="comparison-stat">
                    <span className="comparison-label">累计盈亏</span>
                    <span className={`comparison-value ${parseFloat(stats.fundProfitLoss.replace(/,/g, '')) >= 0 ? 'positive' : 'negative'}`}>
                      {stats.fundProfitLoss}
                    </span>
                  </div>
                  <div className="comparison-stat">
                    <span className="comparison-label">当前资产</span>
                    <span className="comparison-value">{stats.currentFundAsset}</span>
                  </div>
                  {(() => {
                    const stockProfit = parseFloat(stats.stockProfitLoss.replace(/,/g, ''))
                    const fundProfit = parseFloat(stats.fundProfitLoss.replace(/,/g, ''))
                    const totalProfit = stockProfit + fundProfit
                    const fundRatio = totalProfit !== 0 ? (fundProfit / totalProfit * 100) : 0
                    return (
                      <div className="comparison-stat">
                        <span className="comparison-label">占比</span>
                        <span className="comparison-value">{fundRatio.toFixed(1)}%</span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
            {/* 对比图表 */}
            {chartData && (
              <div className="comparison-chart">
                <div style={{ height: '300px', marginTop: '20px' }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            )}
          </div>

          {/* 不同时间段对比分析 */}
          <div className="stats-card">
            <h2 className="stats-title">时间段对比分析</h2>
            <div className="time-comparison-form">
              <div className="comparison-period-group">
                <h3 className="comparison-period-title">时间段一</h3>
                <div className="comparison-date-inputs">
                  <div className="comparison-date-item">
                    <label>开始日期</label>
                    <DatePicker
                      selected={timeComparison.period1Start ? dayjs(timeComparison.period1Start).toDate() : null}
                      onChange={(date) => setTimeComparison(prev => ({ 
                        ...prev, 
                        period1Start: date ? dayjs(date).format('YYYY-MM-DD') : '' 
                      }))}
                      dateFormat="yyyy年MM月dd日"
                      locale="zh-CN"
                      customInput={<CustomInput />}
                      wrapperClassName="new-picker-wrapper"
                    />
                  </div>
                  <div className="comparison-date-item">
                    <label>结束日期</label>
                    <DatePicker
                      selected={timeComparison.period1End ? dayjs(timeComparison.period1End).toDate() : null}
                      onChange={(date) => setTimeComparison(prev => ({ 
                        ...prev, 
                        period1End: date ? dayjs(date).format('YYYY-MM-DD') : '' 
                      }))}
                      dateFormat="yyyy年MM月dd日"
                      locale="zh-CN"
                      customInput={<CustomInput />}
                      wrapperClassName="new-picker-wrapper"
                    />
                  </div>
                </div>
              </div>
              
              <div className="comparison-period-group">
                <h3 className="comparison-period-title">时间段二</h3>
                <div className="comparison-date-inputs">
                  <div className="comparison-date-item">
                    <label>开始日期</label>
                    <DatePicker
                      selected={timeComparison.period2Start ? dayjs(timeComparison.period2Start).toDate() : null}
                      onChange={(date) => setTimeComparison(prev => ({ 
                        ...prev, 
                        period2Start: date ? dayjs(date).format('YYYY-MM-DD') : '' 
                      }))}
                      dateFormat="yyyy年MM月dd日"
                      locale="zh-CN"
                      customInput={<CustomInput />}
                      wrapperClassName="new-picker-wrapper"
                    />
                  </div>
                  <div className="comparison-date-item">
                    <label>结束日期</label>
                    <DatePicker
                      selected={timeComparison.period2End ? dayjs(timeComparison.period2End).toDate() : null}
                      onChange={(date) => setTimeComparison(prev => ({ 
                        ...prev, 
                        period2End: date ? dayjs(date).format('YYYY-MM-DD') : '' 
                      }))}
                      dateFormat="yyyy年MM月dd日"
                      locale="zh-CN"
                      customInput={<CustomInput />}
                      wrapperClassName="new-picker-wrapper"
                    />
                  </div>
                </div>
              </div>

              <button className="comparison-btn" onClick={handleTimeComparison}>
                开始对比
              </button>
            </div>

            {comparisonResult && timeComparison.showComparison && (
              <div className="comparison-result">
                <div className="comparison-table">
                  <table className="comparison-stats-table">
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>时间段一<br/>({comparisonResult.period1.startDate} 至 {comparisonResult.period1.endDate})</th>
                        <th>时间段二<br/>({comparisonResult.period2.startDate} 至 {comparisonResult.period2.endDate})</th>
                        <th>差异</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>股票盈亏</td>
                        <td className={comparisonResult.period1.stock.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period1.stock.profitLoss, true)}
                        </td>
                        <td className={comparisonResult.period2.stock.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period2.stock.profitLoss, true)}
                        </td>
                        <td className={comparisonResult.period2.stock.profitLoss - comparisonResult.period1.stock.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period2.stock.profitLoss - comparisonResult.period1.stock.profitLoss, true)}
                        </td>
                      </tr>
                      <tr>
                        <td>股票收益率</td>
                        <td>{comparisonResult.period1.stock.returnRate.toFixed(2)}%</td>
                        <td>{comparisonResult.period2.stock.returnRate.toFixed(2)}%</td>
                        <td className={comparisonResult.period2.stock.returnRate - comparisonResult.period1.stock.returnRate >= 0 ? 'positive' : 'negative'}>
                          {(comparisonResult.period2.stock.returnRate - comparisonResult.period1.stock.returnRate).toFixed(2)}%
                        </td>
                      </tr>
                      <tr>
                        <td>基金盈亏</td>
                        <td className={comparisonResult.period1.fund.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period1.fund.profitLoss, true)}
                        </td>
                        <td className={comparisonResult.period2.fund.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period2.fund.profitLoss, true)}
                        </td>
                        <td className={comparisonResult.period2.fund.profitLoss - comparisonResult.period1.fund.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period2.fund.profitLoss - comparisonResult.period1.fund.profitLoss, true)}
                        </td>
                      </tr>
                      <tr>
                        <td>基金收益率</td>
                        <td>{comparisonResult.period1.fund.returnRate.toFixed(2)}%</td>
                        <td>{comparisonResult.period2.fund.returnRate.toFixed(2)}%</td>
                        <td className={comparisonResult.period2.fund.returnRate - comparisonResult.period1.fund.returnRate >= 0 ? 'positive' : 'negative'}>
                          {(comparisonResult.period2.fund.returnRate - comparisonResult.period1.fund.returnRate).toFixed(2)}%
                        </td>
                      </tr>
                      <tr>
                        <td>总盈亏</td>
                        <td className={comparisonResult.period1.total.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period1.total.profitLoss, true)}
                        </td>
                        <td className={comparisonResult.period2.total.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period2.total.profitLoss, true)}
                        </td>
                        <td className={comparisonResult.period2.total.profitLoss - comparisonResult.period1.total.profitLoss >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(comparisonResult.period2.total.profitLoss - comparisonResult.period1.total.profitLoss, true)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 图表区域 */}
          <div className={`chart-container ${isChartCollapsed ? 'collapsed' : ''}`}>
            <div className="chart-header">
              <h2 className="stats-title">对比趋势图 (盈亏百分比)</h2>
              <div className="chart-controls">
                <button
                  type="button"
                  className="chart-collapse-btn"
                  onClick={() => setIsChartCollapsed(v => !v)}
                  aria-expanded={!isChartCollapsed}
                  aria-controls="comparison-chart-panel"
                  title={isChartCollapsed ? '展开图表' : '收起图表'}
                >
                  {isChartCollapsed ? '展开' : '收起'}
                </button>
                <div className="chart-type-toggle">
                  <button
                    type="button"
                    className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
                    onClick={() => setChartType('line')}
                    title="折线图"
                    aria-label="切换为折线图"
                  >
                    📈
                  </button>
                  <button
                    type="button"
                    className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
                    onClick={() => setChartType('bar')}
                    title="柱状图"
                    aria-label="切换为柱状图"
                  >
                    📊
                  </button>
                  <button
                    type="button"
                    className={`chart-type-btn ${chartType === 'pie' ? 'active' : ''}`}
                    onClick={() => setChartType('pie')}
                    title="饼图"
                    aria-label="切换为饼图"
                  >
                    🥧
                  </button>
                </div>
                {chartType !== 'pie' && (
                  <>
                    <div className="chart-period-toggle">
                      <button
                        type="button"
                        className={`chart-period-btn ${chartPeriod === 'day' ? 'active' : ''}`}
                        onClick={() => setChartPeriod('day')}
                        aria-label="切换为日"
                      >
                        日
                      </button>
                      <button
                        type="button"
                        className={`chart-period-btn ${chartPeriod === 'week' ? 'active' : ''}`}
                        onClick={() => setChartPeriod('week')}
                        aria-label="切换为周"
                      >
                        周
                      </button>
                      <button
                        type="button"
                        className={`chart-period-btn ${chartPeriod === 'month' ? 'active' : ''}`}
                        onClick={() => setChartPeriod('month')}
                        aria-label="切换为月"
                      >
                        月
                      </button>
                      <button
                        type="button"
                        className={`chart-period-btn ${chartPeriod === 'year' ? 'active' : ''}`}
                        onClick={() => setChartPeriod('year')}
                        aria-label="切换为年"
                      >
                        年
                      </button>
                    </div>
                    {chartType === 'line' && (
                      <label className="ma-toggle">
                        <input
                          type="checkbox"
                          checked={showMovingAverage}
                          onChange={(e) => setShowMovingAverage(e.target.checked)}
                        />
                        <span>移动平均线</span>
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
            <div
              id="comparison-chart-panel"
              className="chart-panel"
              aria-hidden={isChartCollapsed}
            >
              {isChartCollapsed ? null : isLoading ? (
                <SkeletonChart />
              ) : chartData ? (
                <div style={{ height: '400px' }}>
                  {chartType === 'line' && <Line data={chartData} options={chartOptions} />}
                  {chartType === 'bar' && <Bar data={chartData} options={chartOptions} />}
                  {chartType === 'pie' && <Pie data={chartData} options={pieChartOptions} />}
                </div>
              ) : (
                <EmptyState type="chart" />
              )}
            </div>
          </div>

          {/* 历史记录列表 */}
          <div className="stats-card">
            <div className="stats-header-with-action">
              <h2 className="stats-title">历史记录</h2>
              <div className="header-actions-group">
                {/* 类型筛选按钮组 */}
                <div className="filter-type-group">
                  <button
                    className={`filter-type-btn ${historyFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setHistoryFilter('all')}
                  >
                    全部
                  </button>
                  <button
                    className={`filter-type-btn ${historyFilter === 'stock' ? 'active' : ''}`}
                    onClick={() => setHistoryFilter('stock')}
                  >
                    股票
                  </button>
                  <button
                    className={`filter-type-btn ${historyFilter === 'fund' ? 'active' : ''}`}
                    onClick={() => setHistoryFilter('fund')}
                  >
                    基金
                  </button>
                </div>
                {/* 导出按钮组 */}
                <div className="export-buttons-group">
                  <button 
                    className="export-btn" 
                    onClick={() => handleExport('excel')}
                    title="导出为Excel"
                  >
                    📊 Excel
                  </button>
                  <button 
                    className="export-btn" 
                    onClick={() => handleExport('csv')}
                    title="导出为CSV"
                  >
                    📄 CSV
                  </button>
                </div>
                <button 
                  className="expand-btn" 
                  onClick={() => setIsFullScreen(true)}
                  title="全屏查看"
                  aria-label="全屏查看表格"
                >
                  <span className="expand-icon">⛶</span>
                </button>
              </div>
            </div>
            <div className="history-table-container">
              {/* 批量操作栏 */}
              {selectedRecords.length > 0 && (
                <div className="batch-actions-bar">
                  <span>已选择 {selectedRecords.length} 条记录</span>
                  <button className="batch-delete-btn" onClick={handleBatchDelete}>
                    批量删除
                  </button>
                  <button className="batch-cancel-btn" onClick={() => setSelectedRecords([])}>
                    取消选择
                  </button>
                </div>
              )}
              {isLoading ? (
                <SkeletonTable />
              ) : historyData.length === 0 ? (
                <EmptyState type="history" />
              ) : (
                <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedRecords.length > 0 && selectedRecords.length === (() => {
                          const filtered = historyFilter === 'all' 
                            ? historyData 
                            : historyData.filter(item => {
                                if (historyFilter === 'stock') return item.type === '股票'
                                if (historyFilter === 'fund') return item.type === '基金'
                                return true
                              })
                          return filtered.length
                        })()}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const filtered = historyFilter === 'all' 
                              ? historyData 
                              : historyData.filter(item => {
                                  if (historyFilter === 'stock') return item.type === '股票'
                                  if (historyFilter === 'fund') return item.type === '基金'
                                  return true
                                })
                            setSelectedRecords(filtered)
                          } else {
                            setSelectedRecords([])
                          }
                        }}
                      />
                    </th>
                    <th>日期</th>
                    <th>类型</th>
                    <th>总资产</th>
                    <th>总市值</th>
                    <th>上证指数</th>
                    <th>当日盈亏</th>
                    <th>加减仓</th>
                    <th>备注</th>
                    <th style={{ width: '120px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // 根据筛选条件过滤数据
                    const filteredData = historyFilter === 'all' 
                      ? historyData 
                      : historyData.filter(item => {
                          if (historyFilter === 'stock') return item.type === '股票'
                          if (historyFilter === 'fund') return item.type === '基金'
                          return true
                        })
                    
                    return filteredData.length > 0 ? (
                      filteredData.map((item, index) => {
                        const isSelected = selectedRecords.some(r => r.originalData.objectId === item.originalData.objectId)
                        return (
                          <tr key={item.originalData.objectId || index} className={isSelected ? 'row-selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleRecordSelection(item)}
                              />
                            </td>
                            <td>{item.date}</td>
                            <td>{item.type}</td>
                            <td>{item.totalAsset}</td>
                            <td>{item.totalMarketValue}</td>
                            <td>{item.shanghaiIndex}</td>
                            <td className={item.profitClass}>
                              <TrendIndicator value={item.dailyProfitLoss} showArrow={true} showSign={false} />
                            </td>
                            <td className={item.adjustmentClass}>{item.adjustmentAmount}</td>
                            <td>{item.notes}</td>
                            <td>
                              <div className="action-buttons">
                                <button 
                                  className="edit-btn" 
                                  onClick={() => handleEditRecord(item)}
                                  title="编辑"
                                >
                                  编辑
                                </button>
                                <button 
                                  className="delete-btn" 
                                  onClick={() => handleDeleteRecord(item)}
                                  title="删除"
                                >
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                          <EmptyState 
                            type="history" 
                            message={historyFilter === 'all' ? '暂无记录' : `暂无${historyFilter === 'stock' ? '股票' : '基金'}记录`}
                          />
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 全屏表格弹出层 */}
      {isFullScreen && (
        <div className="fullscreen-overlay" onClick={(e) => {
          // 点击遮罩层关闭全屏
          if (e.target === e.currentTarget) {
            setIsFullScreen(false)
          }
        }}>
          <div className="fullscreen-content">
            <div className="fullscreen-header">
              <h2>历史记录详情</h2>
              <button className="close-fullscreen" onClick={() => setIsFullScreen(false)}>✕ 关闭</button>
            </div>
            <div className="fullscreen-table-wrapper">
              {/* 全屏模式下的筛选按钮 */}
              <div className="fullscreen-filter-group">
                <button
                  className={`filter-type-btn ${historyFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('all')}
                >
                  全部
                </button>
                <button
                  className={`filter-type-btn ${historyFilter === 'stock' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('stock')}
                >
                  股票
                </button>
                <button
                  className={`filter-type-btn ${historyFilter === 'fund' ? 'active' : ''}`}
                  onClick={() => setHistoryFilter('fund')}
                >
                  基金
                </button>
              </div>
              <div className="fullscreen-table-scroll">
                <table className="history-table fullscreen-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>类型</th>
                    <th>总资产</th>
                    <th>总市值</th>
                    <th>上证指数</th>
                    <th>当日盈亏</th>
                    <th>加减仓</th>
                    <th>备注</th>
                    <th style={{ width: '120px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // 根据筛选条件过滤数据
                    const filteredData = historyFilter === 'all' 
                      ? historyData 
                      : historyData.filter(item => {
                          if (historyFilter === 'stock') return item.type === '股票'
                          if (historyFilter === 'fund') return item.type === '基金'
                          return true
                        })
                    
                    return filteredData.length > 0 ? (
                      filteredData.map((item, index) => (
                        <tr key={item.originalData?.objectId || index}>
                          <td>{item.date}</td>
                          <td>{item.type}</td>
                          <td>{item.totalAsset}</td>
                          <td>{item.totalMarketValue}</td>
                          <td>{item.shanghaiIndex}</td>
                          <td className={item.profitClass}>{item.dailyProfitLoss}</td>
                          <td className={item.adjustmentClass}>{item.adjustmentAmount}</td>
                          <td>{item.notes}</td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="edit-btn" 
                                onClick={() => handleEditRecord(item)}
                                title="编辑"
                              >
                                编辑
                              </button>
                              <button 
                                className="delete-btn" 
                                onClick={() => handleDeleteRecord(item)}
                                title="删除"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                          {historyFilter === 'all' ? '暂无记录' : `暂无${historyFilter === 'stock' ? '股票' : '基金'}记录`}
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑记录模态框 */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}
    </div>
  )
}

// 编辑记录模态框组件
function EditRecordModal({ record, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    date: record.date,
    investmentType: record.investmentType,
    totalAsset: record.totalAsset?.toString() || '',
    totalMarketValue: record.totalMarketValue?.toString() || '',
    shanghaiIndex: record.shanghaiIndex?.toString() || '',
    notes: record.notes || ''
  })

  const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
    <input
      value={value}
      onClick={onClick}
      ref={ref}
      readOnly
      className="new-picker-input"
    />
  ));

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (date) => {
    if (date) {
      const formattedDate = dayjs(date).format('YYYY-MM-DD')
      setFormData(prev => ({ ...prev, date: formattedDate }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.totalAsset || !formData.date) {
      toast.error('请填写总资产和日期')
      return
    }

    if (parseFloat(formData.totalAsset) <= 0) {
      toast.error('总资产必须大于0')
      return
    }

    if (formData.investmentType === 'stock' && (!formData.totalMarketValue || parseFloat(formData.totalMarketValue) <= 0)) {
      toast.error('请填写总市值')
      return
    }

    const recordData = {
      date: formData.date,
      totalAsset: parseFloat(formData.totalAsset),
      totalMarketValue: formData.investmentType === 'stock' ? parseFloat(formData.totalMarketValue) : null,
      investmentType: formData.investmentType,
      shanghaiIndex: formData.shanghaiIndex ? parseFloat(formData.shanghaiIndex) : null,
      notes: formData.notes || ''
    }

    // 如果有objectId，说明是更新现有记录
    if (record.objectId) {
      recordData.objectId = record.objectId
    }

    await onSave(recordData)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑记录</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-row">
            <label className="form-label">日期</label>
            <DatePicker
              selected={formData.date ? dayjs(formData.date).toDate() : null}
              onChange={handleDateChange}
              dateFormat="yyyy年MM月dd日"
              locale="zh-CN"
              customInput={<CustomInput />}
              wrapperClassName="new-picker-wrapper"
            />
          </div>

          <div className="form-row">
            <label className="form-label">投资类型</label>
            <div className="radio-group horizontal">
              <label className="radio-option">
                <input
                  type="radio"
                  name="investmentType"
                  value="stock"
                  checked={formData.investmentType === 'stock'}
                  onChange={handleInputChange}
                />
                <span className="radio-icon stock-icon">📈</span>
                <span className="radio-label">股票</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="investmentType"
                  value="fund"
                  checked={formData.investmentType === 'fund'}
                  onChange={handleInputChange}
                />
                <span className="radio-icon fund-icon">📊</span>
                <span className="radio-label">基金</span>
              </label>
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">总资产</label>
            <input
              type="number"
              name="totalAsset"
              value={formData.totalAsset}
              onChange={handleInputChange}
              step="0.01"
              className="form-input"
              placeholder="请输入总资产"
              required
            />
          </div>

          {formData.investmentType === 'stock' && (
            <div className="form-row">
              <label className="form-label">总市值</label>
              <input
                type="number"
                name="totalMarketValue"
                value={formData.totalMarketValue}
                onChange={handleInputChange}
                step="0.01"
                className="form-input"
                placeholder="请输入总市值"
                required
              />
            </div>
          )}

          <div className="form-row">
            <label className="form-label">上证指数</label>
            <input
              type="number"
              name="shanghaiIndex"
              value={formData.shanghaiIndex}
              onChange={handleInputChange}
              step="0.01"
              className="form-input"
              placeholder="请输入上证指数"
            />
          </div>

          <div className="form-row">
            <label className="form-label">备注</label>
            <input
              type="text"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="form-input"
              placeholder="可选"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="save-btn">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StatisticsPage

