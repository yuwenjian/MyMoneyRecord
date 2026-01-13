import React, { useState, useEffect, useRef } from 'react'
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
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { getRecords, getAdjustments, formatDate, formatCurrency, saveRecord, deleteRecord, getProfitTargets } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import { getTargetProgress } from '../utils/targetCalculations'
import { ProgressBar } from '../components/ProgressBar'
import { Fireworks } from '../components/Fireworks'
import { TargetSettings } from '../components/TargetSettings'
import { exportToExcel, exportToCSV } from '../utils/export'
import { calculateMonthlyStats, calculateYearlyStats, getAvailablePeriods } from '../utils/periodStats'
import { aggregateByPeriod, calculateMovingAverage, predictTrend } from '../utils/chartUtils'
import { debounce, throttle } from '../utils/debounce'
import { SkeletonCard, SkeletonChart, SkeletonTable, SkeletonStatCard } from '../components/SkeletonLoader'
import { EmptyState } from '../components/EmptyState'
import { TrendIndicator, PercentTrendIndicator } from '../components/TrendIndicator'
import { PageHeader, Card, GradientCard, Button, Input } from '../components/ui'
import toast from 'react-hot-toast'
// import '../styles/StatisticsPage.css' // 已迁移到 Tailwind CSS

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
  
  // 使用 ref 保存最新的日期值，确保 loadStatistics 使用最新的日期
  const startDateRef = useRef('')
  const endDateRef = useRef('')
  
  // 同步更新 ref
  useEffect(() => {
    startDateRef.current = startDate
    endDateRef.current = endDate
  }, [startDate, endDate])

  const [stats, setStats] = useState({
    currentStockAsset: '--',
    currentFundAsset: '--',
    stockProfitLoss: '--',
    fundProfitLoss: '--',
    totalProfitLoss: '--'
  })
  const [chartData, setChartData] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [isChartFullScreen, setIsChartFullScreen] = useState(false)  // 图表全屏状态
  const [isTableFullScreen, setIsTableFullScreen] = useState(false)  // 表格全屏状态
  const [isComparisonFullScreen, setIsComparisonFullScreen] = useState(false)  // 对比图全屏状态
  const [historyFilter, setHistoryFilter] = useState('all') // 'all', 'stock', 'fund'
  const [editingRecord, setEditingRecord] = useState(null) // 正在编辑的记录
  const [selectedRecords, setSelectedRecords] = useState([]) // 选中的记录（用于批量删除）
  const [periodView, setPeriodView] = useState('month') // 'month' or 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(null) // 选中的周期
  const [periodStats, setPeriodStats] = useState(null) // 周期统计
  const [availablePeriods, setAvailablePeriods] = useState({ months: [], years: [] })
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
  const [profitTargets, setProfitTargets] = useState([])
  const [targetProgresses, setTargetProgresses] = useState([])
  const [isTargetProgressExpanded, setIsTargetProgressExpanded] = useState(true)
  const [showTargetSettings, setShowTargetSettings] = useState(false)
  const [showFireworks, setShowFireworks] = useState(false)
  const [achievedTargets, setAchievedTargets] = useState(new Set())

  useEffect(() => {
    const initDates = async () => {
      try {
        const records = await getRecords()
        // 开始日期默认为当前年的1月1号
        const currentYearStart = dayjs().startOf('year').format('YYYY-MM-DD')
        
        if (records.length > 0) {
          const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
          const lastDate = sortedRecords[sortedRecords.length - 1].date
          
          console.log(`[初始化日期] 设置开始日期: ${currentYearStart}, 结束日期: ${lastDate}`)
          setStartDate(currentYearStart)
          setEndDate(lastDate)
        } else {
          // 如果没有记录，设置默认日期为当前年的1月1号到今天
          const today = dayjs().format('YYYY-MM-DD')
          console.log(`[初始化日期] 设置开始日期: ${currentYearStart}, 结束日期: ${today}`)
          setStartDate(currentYearStart)
          setEndDate(today)
        }
      } catch (error) {
        console.error('初始化日期失败:', error)
        // 即使出错也设置默认日期，避免页面卡住
        const currentYearStart = dayjs().startOf('year').format('YYYY-MM-DD')
        const today = dayjs().format('YYYY-MM-DD')
        setStartDate(currentYearStart)
        setEndDate(today)
        toast.error('初始化日期失败，使用默认日期')
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
    // 确保日期已经初始化后再加载统计数据
    // 检查日期格式是否正确（YYYY-MM-DD）
    const isValidDate = (date) => {
      if (!date) return false
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      return dateRegex.test(date)
    }
    
    if (startDate && endDate && isValidDate(startDate) && isValidDate(endDate)) {
      // 添加调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log(`[日期变化] startDate: ${startDate}, endDate: ${endDate}`)
      }
      // 使用最新的 startDate 和 endDate 值
      debouncedLoadStatistics()
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[日期检查] 日期未初始化或格式不正确: startDate=${startDate}, endDate=${endDate}`)
      }
      // 如果日期未初始化，设置加载状态为 false
      setIsLoading(false)
    }
    
    // 加载周期统计（不依赖日期范围）
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

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullScreenChange = () => {
      const isInFullScreen = !!document.fullscreenElement
      setIsChartFullScreen(isInFullScreen)
    }
    
    document.addEventListener('fullscreenchange', handleFullScreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange)
    document.addEventListener('mozfullscreenchange', handleFullScreenChange)
    document.addEventListener('MSFullscreenChange', handleFullScreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange)
    }
  }, [])

  // 全屏切换函数
  const toggleFullScreen = async () => {
    const chartContainer = document.getElementById('chart-fullscreen-container')
    if (!chartContainer) {
      console.warn('找不到图表容器')
      return
    }

    try {
      // 如果已经是全屏状态，退出全屏
      if (isChartFullScreen) {
        // 尝试退出浏览器全屏
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen()
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen()
          } else if (document.mozCancelFullScreen) {
            await document.mozCancelFullScreen()
          } else if (document.msExitFullscreen) {
            await document.msExitFullscreen()
          }
        }
        
        // 解锁屏幕方向
        try {
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock()
          }
        } catch (err) {
          console.log('无法解锁屏幕方向:', err)
        }
        
        // 手动更新状态（移动端可能不触发 fullscreenchange 事件）
        setIsChartFullScreen(false)
        return
      }

      // 进入全屏状态
      setIsChartFullScreen(true)
      
      // 尝试使用浏览器全屏 API（桌面端和部分移动端支持）
      let fullscreenSuccess = false
      try {
        if (chartContainer.requestFullscreen) {
          await chartContainer.requestFullscreen()
          fullscreenSuccess = true
        } else if (chartContainer.webkitRequestFullscreen) {
          await chartContainer.webkitRequestFullscreen()
          fullscreenSuccess = true
        } else if (chartContainer.mozRequestFullScreen) {
          await chartContainer.mozRequestFullScreen()
          fullscreenSuccess = true
        } else if (chartContainer.msRequestFullscreen) {
          await chartContainer.msRequestFullscreen()
          fullscreenSuccess = true
        }
      } catch (err) {
        console.log('浏览器全屏 API 不可用，使用 CSS 全屏模式:', err)
        // 移动端通常会到这里，但状态已经设置，CSS 会生效
      }
      
      // 尝试横屏（无论是否成功进入浏览器全屏）
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape')
        }
      } catch (err) {
        console.log('无法锁定屏幕方向:', err)
      }
      
      // 如果浏览器全屏失败，显示提示
      if (!fullscreenSuccess) {
        console.log('使用 CSS 伪全屏模式')
      }
      
    } catch (err) {
      console.error('全屏切换失败:', err)
      // 即使出错，也保持状态切换（CSS 全屏模式）
      if (!isChartFullScreen) {
        setIsChartFullScreen(true)
      }
    }
  }

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
    // 使用 ref 中的最新日期值，确保使用最新的日期
    const currentStartDate = startDateRef.current
    const currentEndDate = endDateRef.current
    
    // 如果日期未设置，不执行计算
    if (!currentStartDate || !currentEndDate) {
      console.warn('[loadStatistics] 日期未设置，跳过计算')
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    try {
      const records = await getRecords()
      const adjustments = await getAdjustments()

      // 调试日志：检查使用的日期范围
      if (process.env.NODE_ENV === 'development') {
        console.log(`[loadStatistics] 使用的日期范围: startDate=${currentStartDate}, endDate=${currentEndDate}`)
        console.log(`[loadStatistics] state中的日期: startDate=${startDate}, endDate=${endDate}`)
        console.log(`[loadStatistics] 当前时间: ${new Date().toISOString()}`)
      }

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
    
    // 过滤记录 - 使用 ref 中的最新日期值
    let filteredRecords = sortedRecords
    if (currentStartDate || currentEndDate) {
      filteredRecords = sortedRecords.filter(record => {
        const recordDate = dayjs(record.date)
        if (currentStartDate && recordDate.isBefore(dayjs(currentStartDate), 'day')) return false
        if (currentEndDate && recordDate.isAfter(dayjs(currentEndDate), 'day')) return false
        return true
      })
    }
    
    // 调试日志：检查过滤后的记录
    if (process.env.NODE_ENV === 'development' && currentStartDate && currentEndDate) {
      console.log(`[过滤] 日期范围: ${currentStartDate} 至 ${currentEndDate}`)
      console.log(`[过滤] 总记录数: ${sortedRecords.length}, 过滤后记录数: ${filteredRecords.length}`)
      const stockFiltered = filteredRecords.filter(r => r.investmentType === 'stock')
      console.log(`[过滤] 股票记录数: ${stockFiltered.length}, 股票记录日期:`, stockFiltered.map(r => r.date))
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

    // 分别处理股票和基金的盈亏计算
    const investmentTypes = ['stock', 'fund']
    
    investmentTypes.forEach(investmentType => {
      // 获取该投资类型的所有记录（按日期排序）
      const sameTypeRecords = sortedRecords
        .filter(r => r.investmentType === investmentType)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      if (sameTypeRecords.length === 0) return
      
      // 获取日期范围内该投资类型的记录
      const filteredSameTypeRecords = filteredRecords
        .filter(r => r.investmentType === investmentType)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      if (filteredSameTypeRecords.length === 0) return
      
      // 找到开始日期之前的最后一条记录作为基准
      // 使用 ref 中的最新日期值
      let baseRecord = null
      if (currentStartDate) {
        const beforeStartRecords = sameTypeRecords
          .filter(r => dayjs(r.date).isBefore(dayjs(currentStartDate), 'day'))
        if (beforeStartRecords.length > 0) {
          baseRecord = beforeStartRecords[beforeStartRecords.length - 1]
        }
      }
      
      // 如果开始日期之前没有记录，使用第一条记录作为基准（盈亏为0）
      if (!baseRecord) {
        baseRecord = sameTypeRecords[0]
      }
      
      // 计算日期范围内每条记录的盈亏
      // 使用与 targetCalculations.js 完全相同的逻辑
      let tempProfitLoss = 0
      
      // 打印详细的日志
      console.log(`\n========== ${investmentType === 'stock' ? '股票' : '基金'} 收益计算 (${currentStartDate} 至 ${currentEndDate}) ==========`)
      console.log(`基准记录日期: ${baseRecord?.date}, 基准资产: ${baseRecord?.totalAsset}`)
      console.log(`日期范围内记录数: ${filteredSameTypeRecords.length}`)
      console.log(`日期范围内记录日期列表:`, filteredSameTypeRecords.map(r => r.date))
      console.log(`\n开始逐条计算:`)
      
      filteredSameTypeRecords.forEach((record, filterIndex) => {
        // 找到当前记录在所有同类型记录中的位置
        const recordIndex = sameTypeRecords.findIndex(r => 
          r.date === record.date && 
          (r.objectId === record.objectId || (!r.objectId && !record.objectId))
        )
        
        // 如果位置>0，使用前一条记录；否则使用基准记录
        const prevRecord = recordIndex > 0 ? sameTypeRecords[recordIndex - 1] : baseRecord
        
        // 获取当天的加减仓金额
        const dayAdjustments = adjustments
          .filter(a => a.date === record.date && a.investmentType === investmentType)
          .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
        
        const dailyProfitLoss = calculateDailyProfitLoss(record, prevRecord, adjustments)
        
        // 详细日志
        console.log(`\n记录 ${filterIndex + 1}:`)
        console.log(`  日期: ${record.date}`)
        console.log(`  当前资产: ${record.totalAsset}`)
        console.log(`  前一条记录日期: ${prevRecord?.date}`)
        console.log(`  前一条记录资产: ${prevRecord?.totalAsset}`)
        console.log(`  当天加减仓: ${dayAdjustments.toFixed(2)}`)
        console.log(`  每日盈亏: ${dailyProfitLoss.toFixed(2)}`)
        console.log(`  计算公式: ${record.totalAsset} - ${dayAdjustments.toFixed(2)} - ${prevRecord?.totalAsset} = ${dailyProfitLoss.toFixed(2)}`)
        
        tempProfitLoss += dailyProfitLoss
        console.log(`  累计盈亏: ${tempProfitLoss.toFixed(2)}`)
      })
      
      console.log(`\n========== ${investmentType === 'stock' ? '股票' : '基金'} 最终累计盈亏: ${tempProfitLoss.toFixed(2)} ==========\n`)
      
      if (investmentType === 'stock') {
        stockProfitLoss = tempProfitLoss
      } else if (investmentType === 'fund') {
        fundProfitLoss = tempProfitLoss
      }
      
      // 调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${investmentType}] 日期范围: ${currentStartDate} 至 ${currentEndDate}`)
        console.log(`[${investmentType}] 基准记录: ${baseRecord?.date}, 基准资产: ${baseRecord?.totalAsset}`)
        console.log(`[${investmentType}] 日期范围内记录数: ${filteredSameTypeRecords.length}`)
        console.log(`[${investmentType}] 日期范围内记录日期:`, filteredSameTypeRecords.map(r => r.date))
        console.log(`[${investmentType}] 累计盈亏: ${investmentType === 'stock' ? stockProfitLoss.toFixed(2) : fundProfitLoss.toFixed(2)}`)
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
    
    // 加载目标进度
    await loadTargetProgresses(records, adjustments)
    } catch (error) {
      console.error('加载统计数据失败:', error)
      toast.error('加载数据失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  // 加载目标进度
  const loadTargetProgresses = async (records, adjustments) => {
    try {
      const targets = await getProfitTargets()
      setProfitTargets(targets)
      
      const progresses = targets.map(target => 
        getTargetProgress(target, records, adjustments)
      )
      setTargetProgresses(progresses)
      
      // 检查是否有新达成的目标
      const newlyAchieved = new Set()
      progresses.forEach(progress => {
        const key = `${progress.investmentType}-${progress.period}`
        if (progress.isAchieved && !achievedTargets.has(key)) {
          newlyAchieved.add(key)
        }
      })
      
      // 如果有新达成的目标，显示烟花
      if (newlyAchieved.size > 0) {
        setShowFireworks(true)
        setAchievedTargets(prev => {
          const updated = new Set(prev)
          newlyAchieved.forEach(key => updated.add(key))
          return updated
        })
        setTimeout(() => setShowFireworks(false), 3000) // 3秒后关闭烟花
      }
    } catch (error) {
      console.error('加载目标进度失败:', error)
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

    // 按日期分组，避免同一日期重复显示
    const dateRecordsMap = new Map()
    sortedFiltered.forEach((record) => {
      const date = record.date
      if (!dateRecordsMap.has(date)) {
        dateRecordsMap.set(date, { stock: null, fund: null })
      }
      const dateRecords = dateRecordsMap.get(date)
      dateRecords[record.investmentType] = record
    })

    // 按日期顺序生成标签和数据
    Array.from(dateRecordsMap.keys()).sort().forEach(date => {
      // 根据周期格式化标签
      let labelText = ''
      if (chartPeriod === 'day') {
        labelText = formatDate(date)
      } else if (chartPeriod === 'week') {
        const dateObj = dayjs(date)
        labelText = `${dateObj.format('YYYY-MM-DD')}周`
      } else if (chartPeriod === 'month') {
        const dateObj = dayjs(date)
        labelText = dateObj.format('YYYY年MM月')
      } else if (chartPeriod === 'year') {
        const dateObj = dayjs(date)
        labelText = dateObj.format('YYYY年')
      }
      labels.push(labelText)

      const { stock, fund } = dateRecordsMap.get(date)

      // 处理股票记录
      if (stock) {
        const sameTypeRecords = allRecords
          .filter(r => r.investmentType === 'stock')
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        const recordIndex = sameTypeRecords.findIndex(r => 
          r.date === stock.date && r.objectId === stock.objectId
        )
        
        let prevRecord = null
        if (recordIndex > 0) {
          prevRecord = sameTypeRecords[recordIndex - 1]
        } else if (recordIndex === 0) {
          for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
            if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(stock.date), 'day')) {
              prevRecord = sameTypeRecords[i]
              break
            }
          }
        }
        
        const dailyProfitLoss = calculateDailyProfitLoss(stock, prevRecord, adjustments)
        const currentStockAsset = stock.totalAsset || 0
        const stockPercent = ((currentStockAsset - initialStockAsset) / initialStockAsset) * 100
        stockCumulativeProfit.push(stockPercent)
        stockDailyProfit.push(dailyProfitLoss)
      } else {
        stockCumulativeProfit.push(null)
        stockDailyProfit.push(null)
      }

      // 处理基金记录
      if (fund) {
        const sameTypeRecords = allRecords
          .filter(r => r.investmentType === 'fund')
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        const recordIndex = sameTypeRecords.findIndex(r => 
          r.date === fund.date && r.objectId === fund.objectId
        )
        
        let prevRecord = null
        if (recordIndex > 0) {
          prevRecord = sameTypeRecords[recordIndex - 1]
        } else if (recordIndex === 0) {
          for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
            if (dayjs(sameTypeRecords[i].date).isBefore(dayjs(fund.date), 'day')) {
              prevRecord = sameTypeRecords[i]
              break
            }
          }
        }
        
        const dailyProfitLoss = calculateDailyProfitLoss(fund, prevRecord, adjustments)
        const currentFundAsset = fund.totalAsset || 0
        const fundPercent = ((currentFundAsset - initialFundAsset) / initialFundAsset) * 100
        fundCumulativeProfit.push(fundPercent)
        fundDailyProfit.push(dailyProfitLoss)
      } else {
        fundCumulativeProfit.push(null)
        fundDailyProfit.push(null)
      }

      // 处理上证指数（优先使用股票记录的指数，其次是基金记录）
      const indexRecord = stock || fund
      if (indexRecord && indexRecord.shanghaiIndex) {
        const indexPercent = ((indexRecord.shanghaiIndex - initialIndex) / initialIndex) * 100
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
          borderColor: 'rgb(33, 150, 243)',
          backgroundColor: chartType === 'bar' ? 'rgba(33, 150, 243, 0.6)' : 'rgba(33, 150, 243, 0.1)',
          tension: chartType === 'line' ? 0.1 : 0,
          spanGaps: true
        },
        {
          label: '股票收益',
          data: stockCumulativeProfit,
          borderColor: 'rgb(244, 67, 54)',
          backgroundColor: chartType === 'bar' ? 'rgba(244, 67, 54, 0.6)' : 'rgba(244, 67, 54, 0.1)',
          tension: chartType === 'line' ? 0.1 : 0,
          spanGaps: true
        },
        {
          label: '基金收益',
          data: fundCumulativeProfit,
          borderColor: 'rgb(255, 193, 7)',
          backgroundColor: chartType === 'bar' ? 'rgba(255, 193, 7, 0.6)' : 'rgba(255, 193, 7, 0.1)',
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
          borderColor: 'rgba(244, 67, 54, 0.5)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.1,
          spanGaps: true,
          pointRadius: 0
        })
        
        datasets.push({
          label: '基金移动平均(5期)',
          data: fundMA,
          borderColor: 'rgba(255, 193, 7, 0.5)',
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
    // 开始日期默认为当前年的1月1号
    const currentYearStart = dayjs().startOf('year').format('YYYY-MM-DD')
    
    if (records.length > 0) {
      const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
      const lastDate = sortedRecords[sortedRecords.length - 1].date
      
      setStartDate(currentYearStart)
      setEndDate(lastDate)
    } else {
      // 如果没有记录，设置默认日期为当前年的1月1号到今天
      const today = dayjs().format('YYYY-MM-DD')
      setStartDate(currentYearStart)
      setEndDate(today)
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
        labels: {
          color: isChartFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        }
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
          text: '日期',
          color: isChartFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        },
        ticks: {
          color: isChartFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          color: isChartFullScreen ? 'rgba(0, 0, 0, 0.1)' : undefined,  // 全屏时浅灰色网格
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: '盈亏百分比（%）',
          color: isChartFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        },
        ticks: {
          color: isChartFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
          callback: function(value) {
            return value.toFixed(2) + '%'
          }
        },
        grid: {
          color: isChartFullScreen ? 'rgba(0, 0, 0, 0.1)' : undefined,  // 全屏时浅灰色网格
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
        labels: {
          color: isChartFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        }
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

  // 对比图表独立配置（基于 isComparisonFullScreen）
  const comparisonChartOptions = {
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
        labels: {
          color: isComparisonFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        }
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
          text: '日期',
          color: isComparisonFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        },
        ticks: {
          color: isComparisonFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          color: isComparisonFullScreen ? 'rgba(0, 0, 0, 0.1)' : undefined,  // 全屏时浅灰色网格
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: '盈亏百分比（%）',
          color: isComparisonFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
        },
        ticks: {
          color: isComparisonFullScreen ? '#333333' : undefined,  // 全屏时强制黑色
          callback: function(value) {
            return value.toFixed(2) + '%'
          }
        },
        grid: {
          color: isComparisonFullScreen ? 'rgba(0, 0, 0, 0.1)' : undefined,  // 全屏时浅灰色网格
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="统计分析"
        subtitle="欢迎回来, AI 实时监测中..."
      />

      {/* 日期范围选择 */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">日期范围</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="选择开始日期"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="选择结束日期"
            />
          </div>
        </div>
      </Card>

      {/* 仪表盘 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GradientCard>
            <div>
              <div className="text-sm text-blue-100 mb-1">总资产</div>
              <div className="text-3xl font-bold">
                {(() => {
                  const stock = stats.currentStockAsset === '--' ? 0 : parseFloat(stats.currentStockAsset.replace(/,/g, '')) || 0
                  const fund = stats.currentFundAsset === '--' ? 0 : parseFloat(stats.currentFundAsset.replace(/,/g, '')) || 0
                  return formatCurrency(stock + fund)
                })()}
              </div>
            </div>
          </GradientCard>
          
          <GradientCard fromColor="from-green-600" toColor="to-green-700">
            <div>
              <div className="text-sm text-green-100 mb-1">总盈亏</div>
              <div className="text-3xl font-bold">
                <TrendIndicator 
                  value={stats.totalProfitLoss} 
                  showArrow={true} 
                  showSign={false}
                />
              </div>
            </div>
          </GradientCard>
        </div>
      )}

      {/* 收益目标进度 */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
          <h2 className="text-lg font-semibold text-gray-800">收益目标进度</h2>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setIsTargetProgressExpanded(!isTargetProgressExpanded)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              title={isTargetProgressExpanded ? "收起" : "展开"}
            >
              <span>{isTargetProgressExpanded ? '▼' : '▶'}</span>
              <span>{isTargetProgressExpanded ? '收起' : '展开'}</span>
            </button>
            <button
              onClick={() => setShowTargetSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="设置目标"
            >
              <img src="/assets/images/shezhi.png" alt="设置" className="w-5 h-5" />
            </button>
          </div>
        </div>
        {isTargetProgressExpanded && (
          <>
            {targetProgresses.length > 0 ? (
              <div className="space-y-6">
                {(() => {
                  const periodOrder = { 'week': 1, 'month': 2, 'year': 3 }
                  const groupedByPeriod = targetProgresses.reduce((acc, progress) => {
                    const period = progress.period
                    if (!acc[period]) {
                      acc[period] = []
                    }
                    acc[period].push(progress)
                    return acc
                  }, {})
                  
                  return Object.keys(groupedByPeriod)
                    .sort((a, b) => periodOrder[a] - periodOrder[b])
                    .map(period => {
                      const periodLabel = 
                        period === 'week' ? '每周' :
                        period === 'month' ? '每月' : '每年'
                      
                      const sortedProgresses = groupedByPeriod[period]
                        .sort((a, b) => {
                          if (a.investmentType === 'stock' && b.investmentType === 'fund') return -1
                          if (a.investmentType === 'fund' && b.investmentType === 'stock') return 1
                          return 0
                        })
                      
                      return (
                        <div key={period} className="space-y-3">
                          <h3 className="text-md font-semibold text-gray-700">{periodLabel}</h3>
                          {sortedProgresses.map((progress) => {
                            const typeLabel = progress.investmentType === 'stock' ? '股票' : '基金'
                            const label = `${typeLabel} - ${periodLabel}`
                            
                            return (
                              <div key={`${progress.investmentType}-${progress.period}`} className="mb-4">
                                <ProgressBar
                                  percentage={progress.percentage}
                                  isAchieved={progress.isAchieved}
                                  label={label}
                                  actualValue={formatCurrency(progress.actualProfit, true)}
                                  targetValue={formatCurrency(progress.targetAmount)}
                                  investmentType={progress.investmentType}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>暂无收益目标，点击右上角 <img src="/assets/images/shezhi.png" alt="设置" className="inline w-4 h-4 align-middle" /> 按钮设置目标</p>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 持仓分布 */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">持仓分布</h2>
        <div className="space-y-4">
          {(() => {
            const stock = stats.currentStockAsset === '--' ? 0 : parseFloat(stats.currentStockAsset.replace(/,/g, '')) || 0
            const fund = stats.currentFundAsset === '--' ? 0 : parseFloat(stats.currentFundAsset.replace(/,/g, '')) || 0
            const total = stock + fund
            const stockRatio = total > 0 ? (stock / total * 100) : 0
            const fundRatio = total > 0 ? (fund / total * 100) : 0
            
            return (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">股票</span>
                    <span className="text-sm font-semibold text-gray-600">{stockRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all" 
                      style={{ width: `${stockRatio}%` }}
                    ></div>
                  </div>
                  <div className="text-lg font-bold text-gray-800">{stats.currentStockAsset}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">基金</span>
                    <span className="text-sm font-semibold text-gray-600">{fundRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all" 
                      style={{ width: `${fundRatio}%` }}
                    ></div>
                  </div>
                  <div className="text-lg font-bold text-gray-800">{stats.currentFundAsset}</div>
                </div>
              </>
            )
          })()}
        </div>
      </Card>

      {/* 账户资产和盈亏统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 账户资产统计 */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">账户资产</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">当前股票账户总资产</span>
              <span className="text-lg font-semibold text-gray-800">{stats.currentStockAsset}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">当前基金账户总资产</span>
              <span className="text-lg font-semibold text-gray-800">{stats.currentFundAsset}</span>
            </div>
          </div>
        </Card>

        {/* 盈亏统计 */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">盈亏统计 ({startDate} 至 {endDate})</h2>
          {isLoading ? (
            <SkeletonCard />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">股票盈亏资金</span>
                <span className="text-lg font-semibold">
                  <TrendIndicator 
                    value={stats.stockProfitLoss} 
                    showArrow={true} 
                    showSign={true}
                  />
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">基金盈亏资金</span>
                <span className="text-lg font-semibold">
                  <TrendIndicator 
                    value={stats.fundProfitLoss} 
                    showArrow={true} 
                    showSign={true}
                  />
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">总盈亏</span>
                <span className="text-lg font-semibold">
                  <TrendIndicator 
                    value={stats.totalProfitLoss} 
                    showArrow={true} 
                    showSign={false}
                  />
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 月度/年度汇总统计 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">周期汇总统计</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setPeriodView('month')
                setSelectedPeriod(null)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                periodView === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              月度
            </button>
            <button
              onClick={() => {
                setPeriodView('year')
                setSelectedPeriod(null)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                periodView === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              年度
            </button>
          </div>
        </div>
        
        {/* 周期选择器 */}
        <div className="mb-4">
          {periodView === 'month' ? (
            <select
              value={selectedPeriod || ''}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              value={selectedPeriod || ''}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-3">股票统计</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">盈亏金额</span>
                  <span className={`text-sm font-semibold ${periodStats.stock.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(periodStats.stock.profitLoss, true)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">收益率</span>
                  <span className={`text-sm font-semibold ${periodStats.stock.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodStats.stock.returnRate.toFixed(2)}%
                  </span>
                </div>
                {periodView === 'year' && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">年化收益率</span>
                    <span className={`text-sm font-semibold ${(periodStats.stock.annualizedReturn * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(periodStats.stock.annualizedReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">胜率</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {periodStats.stock.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">最大回撤</span>
                  <span className="text-sm font-semibold text-red-600">
                    {periodStats.stock.maxDrawdown.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">交易天数</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {periodStats.stock.days} 天
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-3">基金统计</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">盈亏金额</span>
                  <span className={`text-sm font-semibold ${periodStats.fund.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(periodStats.fund.profitLoss, true)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">收益率</span>
                  <span className={`text-sm font-semibold ${periodStats.fund.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodStats.fund.returnRate.toFixed(2)}%
                  </span>
                </div>
                {periodView === 'year' && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">年化收益率</span>
                    <span className={`text-sm font-semibold ${(periodStats.fund.annualizedReturn * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(periodStats.fund.annualizedReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">胜率</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {periodStats.fund.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">最大回撤</span>
                  <span className="text-sm font-semibold text-red-600">
                    {periodStats.fund.maxDrawdown.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">交易天数</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {periodStats.fund.days} 天
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-3">合计统计</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">总盈亏</span>
                  <span className={`text-sm font-semibold ${periodStats.total.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(periodStats.total.profitLoss, true)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!periodStats && selectedPeriod && (
          <div className="text-center py-8 text-gray-500">
            该周期暂无数据
          </div>
        )}
      </Card>

      {/* 股票与基金收益对比分析 */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">股票与基金收益对比 ({startDate} 至 {endDate})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="border-2 border-red-200 rounded-xl p-6 bg-red-50">
            <div className="flex items-center space-x-3 mb-4">
              <img src="/assets/images/gupiao.png" alt="股票" className="w-8 h-8" />
              <h3 className="text-lg font-semibold text-gray-800">股票</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 mb-1">累计盈亏</div>
                <div className={`text-xl font-bold ${stats.stockProfitLoss === '--' ? 'text-gray-600' : (parseFloat(stats.stockProfitLoss.replace(/,/g, '')) >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                  {stats.stockProfitLoss}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">当前资产</div>
                <div className="text-xl font-bold text-gray-800">{stats.currentStockAsset}</div>
              </div>
              {(() => {
                const stockProfit = stats.stockProfitLoss === '--' ? 0 : parseFloat(stats.stockProfitLoss.replace(/,/g, '')) || 0
                const fundProfit = stats.fundProfitLoss === '--' ? 0 : parseFloat(stats.fundProfitLoss.replace(/,/g, '')) || 0
                const totalProfit = stockProfit + fundProfit
                const stockRatio = totalProfit !== 0 ? (stockProfit / totalProfit * 100) : 0
                return (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">占比</div>
                    <div className="text-xl font-bold text-gray-800">{stockRatio.toFixed(1)}%</div>
                  </div>
                )
              })()}
            </div>
          </div>
          <div className="border-2 border-blue-200 rounded-xl p-6 bg-blue-50">
            <div className="flex items-center space-x-3 mb-4">
              <img src="/assets/images/jijin.png" alt="基金" className="w-8 h-8" />
              <h3 className="text-lg font-semibold text-gray-800">基金</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 mb-1">累计盈亏</div>
                <div className={`text-xl font-bold ${stats.fundProfitLoss === '--' ? 'text-gray-600' : (parseFloat(stats.fundProfitLoss.replace(/,/g, '')) >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                  {stats.fundProfitLoss}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">当前资产</div>
                <div className="text-xl font-bold text-gray-800">{stats.currentFundAsset}</div>
              </div>
              {(() => {
                const stockProfit = stats.stockProfitLoss === '--' ? 0 : parseFloat(stats.stockProfitLoss.replace(/,/g, '')) || 0
                const fundProfit = stats.fundProfitLoss === '--' ? 0 : parseFloat(stats.fundProfitLoss.replace(/,/g, '')) || 0
                const totalProfit = stockProfit + fundProfit
                const fundRatio = totalProfit !== 0 ? (fundProfit / totalProfit * 100) : 0
                return (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">占比</div>
                    <div className="text-xl font-bold text-gray-800">{fundRatio.toFixed(1)}%</div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
        {/* 对比图表 */}
        {chartData && (
          <div 
            id="comparison-chart-fullscreen-container"
            className={`bg-white rounded-xl p-6 shadow-sm ${isComparisonFullScreen ? 'fixed inset-0 z-50 bg-white overflow-y-auto' : ''}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">收益趋势对比</h3>
              <button
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={async () => {
                      const container = document.getElementById('comparison-chart-fullscreen-container')
                      if (!container) {
                        console.warn('找不到对比图表容器')
                        return
                      }
                      
                      try {
                        // 如果已经是全屏状态，退出全屏
                        if (isComparisonFullScreen) {
                          // 尝试退出浏览器全屏
                          if (document.fullscreenElement) {
                            if (document.exitFullscreen) {
                              await document.exitFullscreen()
                            } else if (document.webkitExitFullscreen) {
                              await document.webkitExitFullscreen()
                            } else if (document.mozCancelFullScreen) {
                              await document.mozCancelFullScreen()
                            } else if (document.msExitFullscreen) {
                              await document.msExitFullscreen()
                            }
                          }
                          
                          // 解锁屏幕方向
                          try {
                            if (screen.orientation && screen.orientation.unlock) {
                              screen.orientation.unlock()
                            }
                          } catch (err) {
                            console.log('无法解锁屏幕方向:', err)
                          }
                          
                          // 手动更新状态（移动端可能不触发 fullscreenchange 事件）
                          setIsComparisonFullScreen(false)
                          return
                        }

                        // 进入全屏状态
                        setIsComparisonFullScreen(true)
                        
                        // 尝试使用浏览器全屏 API（桌面端和部分移动端支持）
                        let fullscreenSuccess = false
                        try {
                          if (container.requestFullscreen) {
                            await container.requestFullscreen()
                            fullscreenSuccess = true
                          } else if (container.webkitRequestFullscreen) {
                            await container.webkitRequestFullscreen()
                            fullscreenSuccess = true
                          } else if (container.mozRequestFullScreen) {
                            await container.mozRequestFullScreen()
                            fullscreenSuccess = true
                          } else if (container.msRequestFullscreen) {
                            await container.msRequestFullscreen()
                            fullscreenSuccess = true
                          }
                        } catch (err) {
                          console.log('浏览器全屏 API 不可用，使用 CSS 全屏模式:', err)
                          // 移动端通常会到这里，但状态已经设置，CSS 会生效
                        }
                        
                        // 尝试横屏（无论是否成功进入浏览器全屏）
                        try {
                          if (screen.orientation && screen.orientation.lock) {
                            await screen.orientation.lock('landscape')
                          }
                        } catch (err) {
                          console.log('无法锁定屏幕方向:', err)
                        }
                        
                        // 如果浏览器全屏失败，显示提示
                        if (!fullscreenSuccess) {
                          console.log('对比图表使用 CSS 伪全屏模式')
                        }
                        
                      } catch (err) {
                        console.error('对比图表全屏切换失败:', err)
                        // 即使出错，也保持状态切换（CSS 全屏模式）
                        if (!isComparisonFullScreen) {
                          setIsComparisonFullScreen(true)
                        }
                      }
                    }}
                title={isComparisonFullScreen ? '退出全屏' : '全屏显示'}
                aria-label={isComparisonFullScreen ? '退出全屏' : '全屏显示'}
              >
                {isComparisonFullScreen ? '🗗' : '⛶'}
              </button>
            </div>
            <div className={isComparisonFullScreen ? 'h-[calc(100vh-120px)] pb-5' : 'h-64'}>
              <Line data={chartData} options={comparisonChartOptions} />
            </div>
          </div>
        )}
      </Card>

      {/* 图表区域 */}
      <Card className={isChartFullScreen ? 'fixed inset-0 z-50 bg-white overflow-y-auto' : ''}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">对比趋势图 (盈亏百分比)</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsChartCollapsed(v => !v)}
              aria-expanded={!isChartCollapsed}
            >
              {isChartCollapsed ? '展开' : '收起'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFullScreen}
              title={isChartFullScreen ? '退出全屏' : '全屏显示'}
            >
              {isChartFullScreen ? '🗗' : '⛶'}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chartType === 'line' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              📈 折线
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 柱状
            </button>
            <button
              type="button"
              onClick={() => setChartType('pie')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                chartType === 'pie' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              🥧 饼图
            </button>
          </div>
          {chartType !== 'pie' && (
            <>
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {['day', 'week', 'month', 'year'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setChartPeriod(period)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      chartPeriod === period ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {period === 'day' ? '日' : period === 'week' ? '周' : period === 'month' ? '月' : '年'}
                  </button>
                ))}
              </div>
              {chartType === 'line' && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMovingAverage}
                    onChange={(e) => setShowMovingAverage(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">移动平均线</span>
                </label>
              )}
            </>
          )}
        </div>
        {!isChartCollapsed && (
          <div className={isChartFullScreen ? 'h-[calc(100vh-200px)]' : 'h-96'}>
            {isLoading ? (
              <SkeletonChart />
            ) : chartData ? (
              <>
                {chartType === 'line' && <Line data={chartData} options={chartOptions} />}
                {chartType === 'bar' && <Bar data={chartData} options={chartOptions} />}
                {chartType === 'pie' && <Pie data={chartData} options={pieChartOptions} />}
              </>
            ) : (
              <EmptyState type="chart" />
            )}
          </div>
        )}
      </Card>

      {/* 历史记录列表 */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-lg font-semibold text-gray-800">历史记录</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* 类型筛选按钮组 */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {['all', 'stock', 'fund'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    historyFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter === 'all' ? '全部' : filter === 'stock' ? '股票' : '基金'}
                </button>
              ))}
            </div>
            {/* 导出按钮组 */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('excel')}
              title="导出为Excel"
            >
              📊 Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('csv')}
              title="导出为CSV"
            >
              📄 CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTableFullScreen(true)}
              title="全屏查看"
            >
              ⛶ 全屏
            </Button>
          </div>
        </div>
        {/* 批量操作栏 */}
        {selectedRecords.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-blue-50 rounded-lg mb-4 space-y-2 sm:space-y-0">
            <span className="text-sm font-medium text-gray-700">已选择 {selectedRecords.length} 条记录</span>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
              <Button
                variant="danger"
                size="sm"
                onClick={handleBatchDelete}
              >
                批量删除
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecords([])}
              >
                取消选择
              </Button>
            </div>
          </div>
        )}
        {isLoading ? (
          <SkeletonTable />
        ) : historyData.length === 0 ? (
          <EmptyState type="history" />
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">日期</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">类型</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">总资产</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">总市值</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">上证指数</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">当日盈亏</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">加减仓</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">备注</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 sm:w-32 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
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
                        <tr
                          key={item.originalData.objectId || index}
                          className={`${isSelected ? 'bg-blue-50' : ''} hover:bg-gray-50 transition-colors`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              checked={isSelected}
                              onChange={() => toggleRecordSelection(item)}
                            />
                          </td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">{item.totalAsset}</td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">{item.totalMarketValue}</td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">{item.shanghaiIndex}</td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm">
                            <TrendIndicator value={item.dailyProfitLoss} showArrow={true} showSign={false} />
                          </td>
                          <td className={`px-2 sm:px-4 py-3 whitespace-nowrap text-sm hidden md:table-cell ${item.adjustmentClass?.includes('positive') ? 'text-green-600' : item.adjustmentClass?.includes('negative') ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.adjustmentAmount}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-sm text-gray-900 hidden lg:table-cell">{item.notes}</td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-sm">
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRecord(item)}
                              >
                                编辑
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteRecord(item)}
                              >
                                删除
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="10" className="px-4 py-12 text-center">
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
            </div>
          </div>
        )}
      </Card>

      {/* 全屏表格弹出层 */}
      {isTableFullScreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsTableFullScreen(false)
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">历史记录详情</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTableFullScreen(false)}
              >
                ✕ 关闭
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {/* 全屏模式下的筛选按钮 */}
              <div className="flex space-x-2 mb-4">
                {['all', 'stock', 'fund'].map((filter) => (
                  <Button
                    key={filter}
                    variant={historyFilter === filter ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setHistoryFilter(filter)}
                  >
                    {filter === 'all' ? '全部' : filter === 'stock' ? '股票' : '基金'}
                  </Button>
                ))}
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

      {/* 烟花动画 */}
      <Fireworks 
        show={showFireworks} 
        onComplete={() => setShowFireworks(false)}
      />

      {/* 目标设置弹窗 */}
      {showTargetSettings && (
        <TargetSettings
          onClose={() => setShowTargetSettings(false)}
          onUpdate={() => {
            loadStatistics()
          }}
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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="native-date-input"
              required
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
                <span className="radio-icon stock-icon">
                  <img 
                    src={formData.investmentType === 'stock' ? '/assets/images/gupiao_white.png' : '/assets/images/gupiao.png'} 
                    alt="股票" 
                  />
                </span>
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
                <span className="radio-icon fund-icon">
                  <img 
                    src={formData.investmentType === 'fund' ? '/assets/images/jijin_white.png' : '/assets/images/jijin.png'} 
                    alt="基金" 
                  />
                </span>
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

