import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

  useEffect(() => {
    loadOverviewData()
  }, [chartPeriod])

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
        subtitle="欢迎回来, AI 实时监测中..."
      />

      {/* 总资产卡片 */}
      <GradientCard>
        <div className="mb-6">
          <h2 className="text-lg font-medium text-blue-100 mb-1">当前总资产 (CNY)</h2>
          <div className="text-4xl lg:text-5xl font-bold">
            {isLoading ? '加载中...' : formatCurrency(overviewData.totalAsset)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-blue-100 mb-1">今日盈亏</div>
            <div className="flex items-center space-x-2">
              <span className={`text-xl font-semibold ${overviewData.todayProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {formatCurrency(overviewData.todayProfit, true)}
              </span>
              {overviewData.todayProfitPercent !== 0 && (
                <span className={`text-sm ${overviewData.todayProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  ({overviewData.todayProfitPercent >= 0 ? '+' : ''}{overviewData.todayProfitPercent.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-100 mb-1">本月收益</div>
            <div className="flex items-center space-x-2">
              <span className={`text-xl font-semibold ${overviewData.monthProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {formatCurrency(overviewData.monthProfit, true)}
              </span>
            </div>
          </div>
        </div>
      </GradientCard>

      {/* 资产构成和图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 资产构成 */}
        <div className="lg:col-span-1 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">资产构成</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-700 font-medium">股票</span>
                </div>
                <span className="text-gray-600 font-semibold">{stockPercent}%</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {formatCurrency(overviewData.stockAsset)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-700 font-medium">基金</span>
                </div>
                <span className="text-gray-600 font-semibold">{fundPercent}%</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {formatCurrency(overviewData.fundAsset)}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link to="/statistics" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              查看详细配置 →
            </Link>
          </div>
        </div>

        {/* 净值增长曲线 */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">净值增长曲线</h3>
            <div className="flex space-x-2">
              {['7d', '1m', 'year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    chartPeriod === period
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
        </div>
      </div>

      {/* AI 智能总结 */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-800">AI 智能总结</h3>
            <span className="text-xs text-gray-500">Gemini Powered</span>
          </div>
          <button className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
            <span>✨</span>
            <span>+ 重新生成 AI 复盘</span>
          </button>
        </div>
        <div className="prose max-w-none text-gray-700">
          <p className="text-sm leading-relaxed">
            <strong>投资总结(股票)</strong> 今日总市值达 {formatCurrency(overviewData.stockAsset)},
            单日实现高额收益 {formatCurrency(overviewData.todayProfit, true)},
            回报率约为 {overviewData.todayProfitPercent.toFixed(2)}%,
            表现极其强劲。全天无加减仓操作,持仓稳定。
          </p>
          <p className="text-sm leading-relaxed mt-3">
            <strong>复盘建议:</strong>
            建议深入分析今日高收益的驱动因素(如行业热点或个股基本面变动),
            确认上涨逻辑的可靠性。在高收益后,应保持警惕,设置合理的止盈或跟踪止损点,
            以锁定盈利并管理潜在回调风险。
          </p>
        </div>
      </div>
    </div>
  )
}

export default OverviewPage

