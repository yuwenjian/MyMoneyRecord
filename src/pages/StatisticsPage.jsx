import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import DatePicker, { registerLocale } from 'react-datepicker'
import zhCN from 'date-fns/locale/zh-CN'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { getRecords, getAdjustments, formatDate, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import 'react-datepicker/dist/react-datepicker.css'
import '../styles/StatisticsPage.css'

// 注册中文语言包
registerLocale('zh-CN', zhCN)

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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

  useEffect(() => {
    const initDates = async () => {
      const records = await getRecords()
      if (records.length > 0) {
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
        const firstDate = sortedRecords[0].date
        const lastDate = sortedRecords[sortedRecords.length - 1].date
        
        setStartDate(firstDate)
        setEndDate(lastDate)
      }
    }

    initDates()
  }, [])

  useEffect(() => {
    loadStatistics()
  }, [startDate, endDate])

  const loadStatistics = async () => {
    const records = await getRecords()
    const adjustments = await getAdjustments()

    if (records.length === 0) return

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

    // 获取当前账户总资产
    const stockRecords = sortedRecords.filter(r => r.investmentType === 'stock')
    const fundRecords = sortedRecords.filter(r => r.investmentType === 'fund')
    
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
      const sameTypeRecords = sortedRecords.filter(r => r.investmentType === record.investmentType)
      let actualPrevRecord = null
      
      // 找到当前记录在同类型记录中的位置
      const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date && r.objectId === record.objectId)
      
      if (recordIndex > 0) {
        // 查找前一条同类型记录
        actualPrevRecord = sameTypeRecords[recordIndex - 1]
      } else if (recordIndex === -1) {
        // 如果找不到当前记录（可能因为过滤），查找日期小于当前记录日期的最近一条同类型记录
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (sameTypeRecords[i].date < record.date) {
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
  }

  const updateChart = (filteredRecords, allRecords, adjustments) => {
    if (filteredRecords.length === 0) {
      setChartData(null)
      return
    }

    const sortedFiltered = [...filteredRecords].sort((a, b) => new Date(a.date) - new Date(b.date))
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

    filteredRecords.forEach((record) => {
      labels.push(formatDate(record.date))

      if (record.investmentType === 'stock') {
        const currentStockAsset = record.totalAsset || 0
        const stockPercent = ((currentStockAsset - initialStockAsset) / initialStockAsset) * 100
        stockCumulativeProfit.push(stockPercent)
        fundCumulativeProfit.push(null)
      } else {
        const currentFundAsset = record.totalAsset || 0
        const fundPercent = ((currentFundAsset - initialFundAsset) / initialFundAsset) * 100
        stockCumulativeProfit.push(null)
        fundCumulativeProfit.push(fundPercent)
      }

      if (record.shanghaiIndex) {
        const indexPercent = ((record.shanghaiIndex - initialIndex) / initialIndex) * 100
        indexData.push(indexPercent)
      } else {
        indexData.push(null)
      }
    })

    setChartData({
      labels,
      datasets: [
        {
          label: '指数趋势',
          data: indexData,
          borderColor: 'rgb(150, 150, 150)',
          backgroundColor: 'rgba(150, 150, 150, 0.1)',
          tension: 0.1,
          spanGaps: true
        },
        {
          label: '股票收益',
          data: stockCumulativeProfit,
          borderColor: 'rgb(231, 76, 60)',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          tension: 0.1,
          spanGaps: true
        },
        {
          label: '基金收益',
          data: fundCumulativeProfit,
          borderColor: 'rgb(80, 200, 120)',
          backgroundColor: 'rgba(80, 200, 120, 0.1)',
          tension: 0.1,
          spanGaps: true
        }
      ]
    })
  }

  const updateHistoryTable = (filteredRecords, allRecords, adjustments) => {
    const sortedFilteredRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date))
    
    const history = sortedFilteredRecords.map((record) => {
      // 查找相同投资类型的前一条记录（日期小于当前记录日期）
      const sameTypeRecords = allRecords.filter(r => r.investmentType === record.investmentType)
      let actualPrevRecord = null
      
      // 找到当前记录在同类型记录中的位置
      const recordIndex = sameTypeRecords.findIndex(r => r.date === record.date && r.objectId === record.objectId)
      
      if (recordIndex > 0) {
        // 查找前一条同类型记录
        actualPrevRecord = sameTypeRecords[recordIndex - 1]
      } else if (recordIndex === -1) {
        // 如果找不到当前记录，查找日期小于当前记录日期的最近一条同类型记录
        for (let i = sameTypeRecords.length - 1; i >= 0; i--) {
          if (sameTypeRecords[i].date < record.date) {
            actualPrevRecord = sameTypeRecords[i]
            break
          }
        }
      }

      const dailyProfitLoss = calculateDailyProfitLoss(record, actualPrevRecord, adjustments)
      
      return {
        date: formatDate(record.date),
        type: record.investmentType === 'stock' ? '股票' : '基金',
        totalAsset: formatCurrency(record.totalAsset || 0),
        totalMarketValue: record.totalMarketValue ? formatCurrency(record.totalMarketValue) : '--',
        shanghaiIndex: record.shanghaiIndex ? record.shanghaiIndex.toFixed(2) : '--',
        dailyProfitLoss: formatCurrency(dailyProfitLoss, true),
        profitClass: dailyProfitLoss >= 0 ? 'profit-positive' : 'profit-negative',
        notes: record.notes || '--'
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
                  dateFormat="yyyy年MM月dd日"
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
                  dateFormat="yyyy年MM月dd日"
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
            <h2 className="stats-title">盈亏统计</h2>
            <div className="stat-item">
              <span className="stat-label">股票盈亏资金</span>
              <span className={`stat-value ${parseFloat(stats.stockProfitLoss.replace(/,/g, '')) >= 0 ? 'positive' : 'negative'}`}>
                {stats.stockProfitLoss}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">基金盈亏资金</span>
              <span className={`stat-value ${parseFloat(stats.fundProfitLoss.replace(/,/g, '')) >= 0 ? 'positive' : 'negative'}`}>
                {stats.fundProfitLoss}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">总盈亏</span>
              <span className={`stat-value ${parseFloat(stats.totalProfitLoss.replace(/,/g, '')) >= 0 ? 'positive' : 'negative'}`}>
                {stats.totalProfitLoss}
              </span>
            </div>
          </div>

          {/* 图表区域 */}
          <div className="chart-container">
            <h2 className="stats-title">对比趋势图</h2>
            {chartData ? (
              <div style={{ height: '400px' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="empty-state">暂无数据，请先添加记录</div>
            )}
          </div>

          {/* 历史记录列表 */}
          <div className="stats-card">
            <div className="stats-header-with-action">
              <h2 className="stats-title">历史记录</h2>
              <button 
                className="expand-btn" 
                onClick={() => setIsFullScreen(true)}
                title="全屏查看"
                aria-label="全屏查看表格"
              >
                <span className="expand-icon">⛶</span>
              </button>
            </div>
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>类型</th>
                    <th>总资产</th>
                    <th>总市值</th>
                    <th>上证指数</th>
                    <th>当日盈亏</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.length > 0 ? (
                    historyData.map((item, index) => (
                      <tr key={index}>
                        <td>{item.date}</td>
                        <td>{item.type}</td>
                        <td>{item.totalAsset}</td>
                        <td>{item.totalMarketValue}</td>
                        <td>{item.shanghaiIndex}</td>
                        <td className={item.profitClass}>{item.dailyProfitLoss}</td>
                        <td>{item.notes}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-state" style={{ textAlign: 'center', padding: '40px' }}>
                        暂无记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
              <table className="history-table fullscreen-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>类型</th>
                    <th>总资产</th>
                    <th>总市值</th>
                    <th>上证指数</th>
                    <th>当日盈亏</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.length > 0 ? (
                    historyData.map((item, index) => (
                      <tr key={index}>
                        <td>{item.date}</td>
                        <td>{item.type}</td>
                        <td>{item.totalAsset}</td>
                        <td>{item.totalMarketValue}</td>
                        <td>{item.shanghaiIndex}</td>
                        <td className={item.profitClass}>{item.dailyProfitLoss}</td>
                        <td>{item.notes}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                        暂无记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StatisticsPage

