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
    <div className="space-y-6">
      <PageHeader
        title="概览"
        subtitle="欢迎回来，AI 实时监测中..."
      />

      {/* 总资产卡片 */}
      <GradientCard className="relative mb-6">
        {/* 日历图标 - 右上角 */}
        <button
          onClick={() => navigate('/calendar')}
          className="absolute top-5 right-5 p-2.5 rounded-xl hover:bg-white/20 active:scale-95 transition-all duration-200 text-white/90 hover:text-white backdrop-blur-sm"
          title="查看日历"
        >
          <FiCalendar size={22} />
        </button>
        
        <div className="mb-6">
          <h2 className="text-base font-medium text-white/90 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-white/60 rounded-full"></span>
            当前总资产 (CNY)
          </h2>
          <div className="text-5xl lg:text-6xl font-bold text-white tracking-tight">
            {isLoading ? (
              <span className="inline-block animate-pulse">加载中...</span>
            ) : (
              formatCurrency(overviewData.totalAsset)
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="text-sm text-white/80 mb-2 font-medium">今日盈亏</div>
            <div className="flex items-center space-x-2">
              <span className={`text-2xl font-bold ${overviewData.todayProfit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {formatCurrency(overviewData.todayProfit, true)}
              </span>
              {overviewData.todayProfitPercent !== 0 && (
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${overviewData.todayProfit >= 0 ? 'bg-green-500/30 text-green-100' : 'bg-red-500/30 text-red-100'}`}>
                  {overviewData.todayProfitPercent >= 0 ? '+' : ''}{overviewData.todayProfitPercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="text-sm text-white/80 mb-2 font-medium">本月收益</div>
            <div className="flex items-center space-x-2">
              <span className={`text-2xl font-bold ${overviewData.monthProfit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {formatCurrency(overviewData.monthProfit, true)}
              </span>
            </div>
          </div>
        </div>
      </GradientCard>

      {/* 资产构成和图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 资产构成 */}
        <Card hover className="lg:col-span-1">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full"></span>
            资产构成
          </h3>
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl p-5 border border-red-200/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm"></div>
                  <span className="text-gray-700 font-semibold">股票</span>
                </div>
                <span className="text-gray-600 font-bold text-lg">{stockPercent}%</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">
                {formatCurrency(overviewData.stockAsset)}
              </div>
              <div className="mt-3 w-full bg-red-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-red-600 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${stockPercent}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-5 border border-blue-200/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm"></div>
                  <span className="text-gray-700 font-semibold">基金</span>
                </div>
                <span className="text-gray-600 font-bold text-lg">{fundPercent}%</span>
              </div>
              <div className="text-3xl font-bold text-gray-800">
                {formatCurrency(overviewData.fundAsset)}
              </div>
              <div className="mt-3 w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${fundPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/portfolio')}
              className="text-primary-600 hover:text-primary-700 text-sm font-semibold flex items-center gap-1 group transition-colors"
            >
              查看详细配置
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </Card>

        {/* 净值增长曲线 */}
        <Card hover className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full"></span>
              净值增长曲线
            </h3>
            <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
              {['7d', '1m', 'year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    chartPeriod === period
                      ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md'
                      : 'text-gray-700 hover:bg-white/50'
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
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                    },
                    x: {
                      grid: {
                        display: false,
                      },
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

      {/* AI 智能分析 */}
      <Card hover>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full"></span>
              AI 智能分析
            </h3>
            <span className="text-xs font-semibold bg-gradient-to-r from-primary-100 to-primary-50 text-primary-700 px-3 py-1.5 rounded-full border border-primary-200">
              🤖 DeepSeek Powered
            </span>
            {todayAnalysisCount > 0 && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                今日已用 {todayAnalysisCount}/3 次
              </span>
            )}
          </div>
          <button 
            onClick={handleRegenerateAI}
            disabled={isGeneratingAI || todayAnalysisCount >= 3}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 rounded-xl hover:from-primary-100 hover:to-primary-200 transition-all duration-200 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed border border-primary-200 active:scale-95"
          >
            {isGeneratingAI ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
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
        <div className="text-gray-700">
          {isGeneratingAI && !aiAnalysis ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500">AI 正在分析中，请稍候...</p>
                <p className="text-xs text-gray-400">（思考模式：正在查询最新市场数据并深度分析）</p>
              </div>
            </div>
          ) : aiAnalysis ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-3 pb-2 border-b border-gray-200" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2" {...props} />,
                  h4: ({node, ...props}) => <h4 className="text-sm font-semibold text-gray-800 mt-3 mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="text-sm leading-relaxed text-gray-700 mb-3" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1.5 mb-3 text-sm text-gray-700 ml-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1.5 mb-3 text-sm text-gray-700 ml-2" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-gray-800" {...props} />,
                  em: ({node, ...props}) => <em className="italic text-gray-600" {...props} />,
                  code: ({node, inline, ...props}) => 
                    inline ? (
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800" {...props} />
                    ) : (
                      <code className="block bg-gray-100 p-3 rounded text-xs font-mono text-gray-800 overflow-x-auto mb-3" {...props} />
                    ),
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-300 pl-4 italic text-gray-600 my-3 bg-blue-50 py-2 rounded-r" {...props} />,
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

