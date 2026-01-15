import React, { useState, useEffect } from 'react'
import { PageHeader, Card, GradientCard } from '../components/ui'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import { getRecords, getAdjustments, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import { generateComprehensiveAnalysis } from '../utils/deepseek'
import { getHoldings } from '../utils/storage'
import { calculateHistoryStatsByType } from '../utils/historyStats'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { FiCalendar } from 'react-icons/fi'
import toast from 'react-hot-toast'

dayjs.extend(isSameOrAfter)

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function OverviewPage() {
  const navigate = useNavigate()
  const [overviewData, setOverviewData] = useState({
    totalAsset: 0,
    todayProfit: 0,
    todayProfitPercent: 0,
    monthProfit: 0,
    stockAsset: 0,
    fundAsset: 0,
  })
  const [chartData, setChartData] = useState(null)
  const [chartPeriod, setChartPeriod] = useState('7d')
  const [isLoading, setIsLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [lastAnalysisDate, setLastAnalysisDate] = useState('')
  const [todayAnalysisCount, setTodayAnalysisCount] = useState(0) // 今日分析次数

  // 生成 AI 分析
  const generateAIAnalysis = React.useCallback(async (data, historyStats) => {
    try {
      setIsGeneratingAI(true)
      const today = dayjs().format('YYYY-MM-DD')
      
      // 检查今日分析次数
      const countKey = `ai_analysis_count_${today}`
      const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10)
      
      if (currentCount >= 3) {
        toast.error('今日AI分析次数已达上限（3次），请明天再试')
        return
      }
      
      // 获取持仓数据
      const [stockHoldings, fundHoldings] = await Promise.all([
        getHoldings('stock'),
        getHoldings('fund')
      ])
      const allHoldings = [...stockHoldings, ...fundHoldings]
      
      // 生成综合分析
      const analysis = await generateComprehensiveAnalysis(data, allHoldings, historyStats)
      
      setAiAnalysis(analysis)
      setLastAnalysisDate(today)
      
      // 更新今日分析次数
      const newCount = currentCount + 1
      setTodayAnalysisCount(newCount)
      localStorage.setItem(countKey, newCount.toString())
      localStorage.setItem(`ai_analysis_${today}`, analysis)
      
      toast.success(`AI分析生成成功（今日第${newCount}/3次）`)
    } catch (error) {
      console.error('生成 AI 分析失败:', error)
      const errorMessage = error.message || '生成 AI 分析失败，请检查 API 配置'
      
      // 如果是 API Key 未配置的错误，显示特殊提示
      if (errorMessage.includes('API Key 未配置')) {
        toast.error(
          (t) => (
            <div className="flex flex-col">
              <span>{errorMessage}</span>
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  navigate('/settings')
                }}
                className="mt-2 text-blue-600 hover:underline text-sm text-left"
              >
                前往设置页面配置 →
              </button>
            </div>
          ),
          { duration: 5000 }
        )
      } else {
        toast.error(errorMessage)
      }
      
      // 如果 API 调用失败，尝试从本地存储加载
      const today = dayjs().format('YYYY-MM-DD')
      const cached = localStorage.getItem(`ai_analysis_${today}`)
      if (cached) {
        setAiAnalysis(cached)
        setLastAnalysisDate(today)
      }
    } finally {
      setIsGeneratingAI(false)
    }
  }, [navigate])

  // 手动重新生成 AI 分析
  const handleRegenerateAI = React.useCallback(async () => {
    const today = dayjs().format('YYYY-MM-DD')
    const countKey = `ai_analysis_count_${today}`
    const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10)
    
    if (currentCount >= 3) {
      toast.error('今日AI分析次数已达上限（3次），请明天再试')
      return
    }
    
    const records = await getRecords()
    const adjustments = await getAdjustments()
    const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
    const todayRecords = sortedRecords.filter(r => r.date === today)
    const todayWithIndex = todayRecords.find(r => r.shanghaiIndex)
    const shanghaiIndex = todayWithIndex ? todayWithIndex.shanghaiIndex : null

    // 计算历史统计数据
    const historyStats7d = calculateHistoryStatsByType(records, adjustments, 7)
    const historyStats30d = calculateHistoryStatsByType(records, adjustments, 30)

    await generateAIAnalysis({
      shanghaiIndex,
      todayProfit: overviewData.todayProfit,
      todayProfitPercent: overviewData.todayProfitPercent,
      stockAsset: overviewData.stockAsset,
      fundAsset: overviewData.fundAsset,
      totalAsset: overviewData.totalAsset,
      monthProfit: overviewData.monthProfit,
      stockPercent: overviewData.totalAsset > 0 ? (overviewData.stockAsset / overviewData.totalAsset * 100).toFixed(0) : 0,
      fundPercent: overviewData.totalAsset > 0 ? (overviewData.fundAsset / overviewData.totalAsset * 100).toFixed(0) : 0,
    }, {
      stats7d: historyStats7d,
      stats30d: historyStats30d
    })
  }, [overviewData, generateAIAnalysis])

  // 加载缓存的 AI 分析
  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const cached = localStorage.getItem(`ai_analysis_${today}`)
    const countKey = `ai_analysis_count_${today}`
    const count = parseInt(localStorage.getItem(countKey) || '0', 10)
    
    if (cached) {
      setAiAnalysis(cached)
      setLastAnalysisDate(today)
    }
    setTodayAnalysisCount(count)
  }, [])

  useEffect(() => {
    loadOverviewData()
  }, [chartPeriod])
  
  // 监听数据更新事件，提示用户可以重新生成AI分析
  useEffect(() => {
    const handleDataUpdate = async (event) => {
      // 数据更新后，重新加载概览数据
      await loadOverviewData()
      
      // 提示用户可以重新生成AI分析
      const today = dayjs().format('YYYY-MM-DD')
      const countKey = `ai_analysis_count_${today}`
      const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10)
      
      if (currentCount < 3) {
        toast.success('数据已更新，可以重新生成AI分析', { duration: 3000 })
      }
    }
    
    window.addEventListener('dataUpdated', handleDataUpdate)
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate)
    }
  }, [])

  const loadOverviewData = async () => {
    try {
      setIsLoading(true)
      const records = await getRecords()
      const adjustments = await getAdjustments()

      if (records.length === 0) {
        setOverviewData({
          totalAsset: 0,
          todayProfit: 0,
          todayProfitPercent: 0,
          monthProfit: 0,
          stockAsset: 0,
          fundAsset: 0,
        })
        setIsLoading(false)
        return
      }

      const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      const today = dayjs().format('YYYY-MM-DD')
      const todayStart = dayjs().startOf('month').format('YYYY-MM-DD')

      // 获取最新资产
      const latestStockRecord = sortedRecords
        .filter(r => r.investmentType === 'stock')
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
      const latestFundRecord = sortedRecords
        .filter(r => r.investmentType === 'fund')
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]

      const stockAsset = latestStockRecord ? (latestStockRecord.totalAsset || 0) : 0
      const fundAsset = latestFundRecord ? (latestFundRecord.totalAsset || 0) : 0
      const totalAsset = stockAsset + fundAsset

      // 计算今日盈亏
      const todayRecords = sortedRecords.filter(r => r.date === today)
      let todayProfit = 0
      const todayStockRecord = todayRecords.find(r => r.investmentType === 'stock')
      const todayFundRecord = todayRecords.find(r => r.investmentType === 'fund')

      if (todayStockRecord) {
        const prevStockRecord = sortedRecords
          .filter(r => r.investmentType === 'stock' && dayjs(r.date).isBefore(dayjs(today), 'day'))
          .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
        todayProfit += calculateDailyProfitLoss(todayStockRecord, prevStockRecord, adjustments)
      }
      if (todayFundRecord) {
        const prevFundRecord = sortedRecords
          .filter(r => r.investmentType === 'fund' && dayjs(r.date).isBefore(dayjs(today), 'day'))
          .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
        todayProfit += calculateDailyProfitLoss(todayFundRecord, prevFundRecord, adjustments)
      }

      // 计算昨日总资产（用于计算今日收益率）
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      const yesterdayRecords = sortedRecords.filter(r => r.date === yesterday)
      const yesterdayStockRecord = yesterdayRecords.find(r => r.investmentType === 'stock')
      const yesterdayFundRecord = yesterdayRecords.find(r => r.investmentType === 'fund')
      const yesterdayStockAsset = yesterdayStockRecord ? (yesterdayStockRecord.totalAsset || 0) : stockAsset
      const yesterdayFundAsset = yesterdayFundRecord ? (yesterdayFundRecord.totalAsset || 0) : fundAsset
      const yesterdayTotalAsset = yesterdayStockAsset + yesterdayFundAsset
      const todayProfitPercent = yesterdayTotalAsset > 0 ? (todayProfit / yesterdayTotalAsset) * 100 : 0

      // 计算本月收益
      const monthRecords = sortedRecords.filter(r => 
        r.date >= todayStart && r.date <= today
      )
      let monthProfit = 0
      const monthStartStockRecord = sortedRecords
        .filter(r => r.investmentType === 'stock' && dayjs(r.date).isBefore(dayjs(todayStart), 'day'))
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
      const monthStartFundRecord = sortedRecords
        .filter(r => r.investmentType === 'fund' && dayjs(r.date).isBefore(dayjs(todayStart), 'day'))
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]

      monthRecords.forEach(record => {
        const sameTypeRecords = sortedRecords.filter(r => r.investmentType === record.investmentType)
        const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date)
        const prevRecord = recordIndex > 0 ? sameTypeRecords[recordIndex - 1] : 
          (record.investmentType === 'stock' ? monthStartStockRecord : monthStartFundRecord)
        monthProfit += calculateDailyProfitLoss(record, prevRecord, adjustments)
      })

      setOverviewData({
        totalAsset,
        todayProfit,
        todayProfitPercent,
        monthProfit,
        stockAsset,
        fundAsset,
      })

      // 生成图表数据
      generateChartData(sortedRecords, chartPeriod)
    } catch (error) {
      console.error('加载概览数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const generateChartData = (records, period) => {
    let startDate
    if (period === '7d') {
      startDate = dayjs().subtract(6, 'day')
    } else if (period === '1m') {
      startDate = dayjs().subtract(1, 'month')
    } else {
      startDate = dayjs().startOf('year')
    }

    const filteredRecords = records.filter(r => 
      dayjs(r.date).isSameOrAfter(startDate, 'day')
    )

    // 按日期聚合总资产
    const dateMap = new Map()
    filteredRecords.forEach(record => {
      const date = record.date
      if (!dateMap.has(date)) {
        dateMap.set(date, { stock: 0, fund: 0 })
      }
      const assets = dateMap.get(date)
      if (record.investmentType === 'stock') {
        assets.stock = record.totalAsset || 0
      } else if (record.investmentType === 'fund') {
        assets.fund = record.totalAsset || 0
      }
    })

    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => dayjs(a).diff(dayjs(b)))
    const labels = sortedDates.map(date => dayjs(date).format('MM-DD'))
    const data = sortedDates.map(date => {
      const assets = dateMap.get(date)
      return (assets.stock || 0) + (assets.fund || 0)
    })

    setChartData({
      labels,
      datasets: [
        {
          label: '总资产',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    })
  }

  const stockPercent = overviewData.totalAsset > 0 
    ? (overviewData.stockAsset / overviewData.totalAsset * 100).toFixed(0)
    : 0
  const fundPercent = overviewData.totalAsset > 0 
    ? (overviewData.fundAsset / overviewData.totalAsset * 100).toFixed(0)
    : 0

  return (
    <div className="space-y-8 lg:space-y-12">
      <PageHeader
        title="概览"
        subtitle="欢迎回来，AI 实时监测中..."
      />

      {/* 总资产卡片 - 非对称重叠设计 */}
      <div className="relative animate-stagger-1">
        <GradientCard className="relative overflow-visible">
          {/* 日历图标 - 调整位置避免遮挡数字 */}
          <button
            onClick={() => navigate('/calendar')}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 sm:p-3 rounded-xl bg-dark-surface/90 backdrop-blur-md border-2 border-amber-500/50 hover:border-amber-400 hover:bg-dark-elevated active:scale-95 transition-all duration-300 text-amber-400 shadow-glow-amber z-30"
            title="查看日历"
          >
            <FiCalendar size={18} className="sm:w-5 sm:h-5" />
          </button>
          
          {/* 非对称布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* 主数字 - 左侧大号显示 */}
            <div className="lg:col-span-7 pr-16 sm:pr-20 lg:pr-6">
              <div className="mb-2">
                <span className="text-sm font-sans font-medium text-white/70 uppercase tracking-wider">
                  当前总资产
                </span>
                <span className="text-xs text-white/50 ml-2">CNY</span>
              </div>
              <div className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-white tracking-tighter leading-none mb-6 break-all">
                {isLoading ? (
                  <span className="inline-block animate-pulse text-white/50">加载中...</span>
                ) : (
                  <span className="number-display text-white drop-shadow-lg">
                    {formatCurrency(overviewData.totalAsset)}
                  </span>
                )}
              </div>
            </div>

            {/* 收益指标 - 右侧小卡片，向左移动 */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-dark-surface/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20 shadow-dark-lg animate-stagger-2">
                <div className="text-xs font-sans font-medium text-amber-400/80 mb-2 uppercase tracking-wider">
                  今日盈亏
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-display font-bold ${overviewData.todayProfit >= 0 ? 'text-success-light' : 'text-danger-light'}`}>
                    {formatCurrency(overviewData.todayProfit, true)}
                  </span>
                  {overviewData.todayProfitPercent !== 0 && (
                    <span className={`text-sm font-sans font-semibold px-2 py-1 rounded-lg ${overviewData.todayProfit >= 0 ? 'bg-success-base/20 text-success-light border border-success-base/30' : 'bg-danger-base/20 text-danger-light border border-danger-base/30'}`}>
                      {overviewData.todayProfitPercent >= 0 ? '+' : ''}{overviewData.todayProfitPercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-dark-surface/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20 shadow-dark-lg animate-stagger-3">
                <div className="text-xs font-sans font-medium text-amber-400/80 mb-2 uppercase tracking-wider">
                  本月收益
                </div>
                <div className="flex items-baseline">
                  <span className={`text-3xl font-display font-bold ${overviewData.monthProfit >= 0 ? 'text-success-light' : 'text-danger-light'}`}>
                    {formatCurrency(overviewData.monthProfit, true)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GradientCard>
      </div>

      {/* 资产构成和图表 - 非对称网格布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* 资产构成 - 左侧窄列 */}
        <Card hover className="lg:col-span-4 animate-stagger-2">
          <h3 className="text-xl font-display font-bold text-amber-400 mb-8 flex items-center gap-3 decorative-line">
            <span className="w-1 h-8 bg-gradient-to-b from-amber-500 to-gold-base rounded-full"></span>
            资产构成
          </h3>
          <div className="space-y-6">
            {/* 股票 */}
            <div className="bg-gradient-to-br from-danger-base/10 to-danger-dark/5 rounded-2xl p-6 border border-danger-base/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-danger-base/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-danger-base shadow-glow-amber"></div>
                    <span className="text-gray-200 font-sans font-semibold text-base">股票</span>
                  </div>
                  <span className="text-amber-400 font-display font-bold text-xl">{stockPercent}%</span>
                </div>
                <div className="text-4xl font-display font-bold text-white mb-4">
                  {formatCurrency(overviewData.stockAsset)}
                </div>
                <div className="w-full bg-dark-border rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-danger-base to-danger-light h-full rounded-full transition-all duration-700 shadow-glow-amber"
                    style={{ width: `${stockPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* 基金 */}
            <div className="bg-gradient-to-br from-amber-500/10 to-gold-base/5 rounded-2xl p-6 border border-amber-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500 shadow-glow-amber"></div>
                    <span className="text-gray-200 font-sans font-semibold text-base">基金</span>
                  </div>
                  <span className="text-amber-400 font-display font-bold text-xl">{fundPercent}%</span>
                </div>
                <div className="text-4xl font-display font-bold text-white mb-4">
                  {formatCurrency(overviewData.fundAsset)}
                </div>
                <div className="w-full bg-dark-border rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-gold-base h-full rounded-full transition-all duration-700 shadow-glow-amber"
                    style={{ width: `${fundPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-dark-border">
            <button
              onClick={() => navigate('/portfolio')}
              className="text-amber-400 hover:text-amber-300 text-sm font-sans font-semibold flex items-center gap-2 group transition-colors"
            >
              查看详细配置
              <span className="group-hover:translate-x-1 transition-transform text-lg">→</span>
            </button>
          </div>
        </Card>

        {/* 净值增长曲线 - 右侧宽列 */}
        <Card hover className="lg:col-span-8 animate-stagger-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-display font-bold text-amber-400 flex items-center gap-3 decorative-line">
              <span className="w-1 h-8 bg-gradient-to-b from-amber-500 to-gold-base rounded-full"></span>
              净值增长曲线
            </h3>
            <div className="flex space-x-2 bg-dark-elevated p-1.5 rounded-xl border border-dark-border">
              {['7d', '1m', 'year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-5 py-2 rounded-lg text-sm font-sans font-semibold transition-all duration-300 ${
                    chartPeriod === period
                      ? 'bg-gradient-to-r from-amber-500 to-gold-base text-dark-bg shadow-glow-amber'
                      : 'text-gray-400 hover:text-amber-400 hover:bg-dark-surface'
                  }`}
                >
                  {period === '7d' ? '7日' : period === '1m' ? '1月' : '今年'}
                </button>
              ))}
            </div>
          </div>
          {chartData ? (
            <div className="h-64">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: false,
                      grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                      },
                      ticks: {
                        color: '#9ca3af',
                        font: {
                          family: 'IBM Plex Sans, sans-serif',
                          size: 11
                        }
                      }
                    },
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9ca3af',
                        font: {
                          family: 'IBM Plex Sans, sans-serif',
                          size: 11
                        }
                      }
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              暂无数据
            </div>
          )}
        </Card>
      </div>

      {/* AI 智能分析 - 全宽编辑风格 */}
      <Card hover className="animate-stagger-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-xl font-display font-bold text-amber-400 flex items-center gap-3 decorative-line">
              <span className="w-1 h-8 bg-gradient-to-b from-amber-500 to-gold-base rounded-full"></span>
              AI 智能分析
            </h3>
            <span className="text-xs font-sans font-semibold bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full border border-amber-500/30 backdrop-blur-sm">
              🤖 DeepSeek Powered
            </span>
            {todayAnalysisCount > 0 && (
              <span className="text-xs text-gray-400 bg-dark-elevated px-3 py-1.5 rounded-full font-sans font-medium border border-dark-border">
                今日已用 {todayAnalysisCount}/3 次
              </span>
            )}
          </div>
          <button 
            onClick={handleRegenerateAI}
            disabled={isGeneratingAI || todayAnalysisCount >= 3}
            className="flex items-center space-x-2 px-5 py-2.5 bg-dark-elevated text-amber-400 rounded-xl hover:bg-dark-surface hover:text-amber-300 transition-all duration-300 text-sm font-sans font-semibold disabled:opacity-50 disabled:cursor-not-allowed border border-amber-500/20 hover:border-amber-500/40 active:scale-95 shadow-dark-lg hover:shadow-glow-amber"
          >
            {isGeneratingAI ? (
              <>
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                <span>生成中...</span>
              </>
            ) : todayAnalysisCount >= 3 ? (
              <>
                <span>⚠️</span>
                <span>今日已达上限</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>生成AI分析</span>
              </>
            )}
          </button>
        </div>
        <div className="text-gray-300">
          {isGeneratingAI && !aiAnalysis ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-300">AI 正在分析中，请稍候...</p>
                <p className="text-xs text-gray-400">（思考模式：正在查询最新市场数据并深度分析）</p>
              </div>
            </div>
          ) : aiAnalysis ? (
            <div className="prose prose-sm max-w-none prose-invert">
              <ReactMarkdown
                components={{
                  h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-amber-400 mt-6 mb-3 pb-2 border-b border-dark-border" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-semibold text-gray-200 mt-4 mb-2" {...props} />,
                  h4: ({node, ...props}) => <h4 className="text-sm font-semibold text-gray-200 mt-3 mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="text-sm leading-relaxed text-gray-300 mb-3" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1.5 mb-3 text-sm text-gray-300 ml-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1.5 mb-3 text-sm text-gray-300 ml-2" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1 text-gray-300" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-gray-200" {...props} />,
                  em: ({node, ...props}) => <em className="italic text-gray-400" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline ? (
                      <code className="bg-dark-elevated px-1.5 py-0.5 rounded text-xs font-mono text-amber-400 border border-dark-border" {...props} />
                    ) : (
                      <code className="block bg-dark-elevated p-3 rounded text-xs font-mono text-amber-400 overflow-x-auto mb-3 border border-dark-border" {...props} />
                    ),
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-amber-500/50 pl-4 italic text-gray-300 my-3 bg-dark-elevated py-2 rounded-r" {...props} />,
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">暂无 AI 分析数据</p>
              <p className="text-xs mt-2">点击"生成AI分析"按钮获取 AI 分析</p>
              <p className="text-xs mt-1 text-gray-400">（每次更新数据后可重新生成，每日最多3次）</p>
            </div>
          )}
        </div>
      </Card>

    </div>
  )
}

export default OverviewPage

