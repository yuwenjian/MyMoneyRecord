import React, { useState, useEffect, useRef } from 'react'
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
import flatpickr from 'flatpickr'
import 'flatpickr/dist/l10n/zh'
import { getRecords, getAdjustments, formatDate, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import '../styles/StatisticsPage.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

function StatisticsPage() {
  const navigate = useNavigate()
  const startDateRef = useRef(null)
  const endDateRef = useRef(null)
  const startDatePickerRef = useRef(null)
  const endDatePickerRef = useRef(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stats, setStats] = useState({
    currentStockAsset: '--',
    currentFundAsset: '--',
    stockProfitLoss: '--',
    fundProfitLoss: '--',
    totalProfitLoss: '--'
  })
  const [chartData, setChartData] = useState(null)
  const [historyData, setHistoryData] = useState([])

  useEffect(() => {
    const initDatePickers = async () => {
      const records = await getRecords()
      if (records.length > 0) {
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date))
        const firstDate = sortedRecords[0].date
        const lastDate = sortedRecords[sortedRecords.length - 1].date
        
        // 初始化日期选择器
        if (startDateRef.current && endDateRef.current) {
          startDatePickerRef.current = flatpickr(startDateRef.current, {
            locale: 'zh',
            dateFormat: 'Y年m月d日',
            defaultDate: new Date(firstDate),
            onChange: function(selectedDates) {
              if (selectedDates[0]) {
                const dateValue = selectedDates[0].toISOString().split('T')[0]
                setStartDate(dateValue)
              }
            }
          })
          
          endDatePickerRef.current = flatpickr(endDateRef.current, {
            locale: 'zh',
            dateFormat: 'Y年m月d日',
            defaultDate: new Date(lastDate),
            onChange: function(selectedDates) {
              if (selectedDates[0]) {
                const dateValue = selectedDates[0].toISOString().split('T')[0]
                setEndDate(dateValue)
              }
            }
          })

          setStartDate(firstDate)
          setEndDate(lastDate)
        }
      }
    }

    initDatePickers()

    return () => {
      if (startDatePickerRef.current) startDatePickerRef.current.destroy()
      if (endDatePickerRef.current) endDatePickerRef.current.destroy()
    }
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
      const recordIndex = sortedRecords.findIndex(r => r.date === record.date)
      let actualPrevRecord = null
      
      if (recordIndex > 0) {
        for (let i = recordIndex - 1; i >= 0; i--) {
          const prev = sortedRecords[i]
          if (!startDate || prev.date >= startDate) {
            actualPrevRecord = prev
            break
          }
        }
        if (!actualPrevRecord && recordIndex > 0) {
          actualPrevRecord = sortedRecords[recordIndex - 1]
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
      const recordIndex = allRecords.findIndex(r => r.date === record.date)
      let actualPrevRecord = null
      
      if (recordIndex > 0) {
        for (let i = recordIndex - 1; i >= 0; i--) {
          const prev = allRecords[i]
          if (!startDate || prev.date >= startDate) {
            actualPrevRecord = prev
            break
          }
        }
        if (!actualPrevRecord && recordIndex > 0) {
          actualPrevRecord = allRecords[recordIndex - 1]
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
      
      if (startDatePickerRef.current) {
        startDatePickerRef.current.setDate(new Date(firstDate), false)
      }
      if (endDatePickerRef.current) {
        endDatePickerRef.current.setDate(new Date(lastDate), false)
      }
      
      setStartDate(firstDate)
      setEndDate(lastDate)
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
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  开始日期
                </label>
                <input
                  ref={startDateRef}
                  type="text"
                  className="form-input"
                  placeholder="请选择开始日期"
                  readOnly
                />
              </div>
              <div className="date-range-item">
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  结束日期
                </label>
                <input
                  ref={endDateRef}
                  type="text"
                  className="form-input"
                  placeholder="请选择结束日期"
                  readOnly
                />
              </div>
              <div className="date-range-buttons">
                <button className="filter-btn-stat" onClick={loadStatistics}>筛选</button>
                <button
                  className="filter-btn-stat"
                  style={{ backgroundColor: 'var(--white)', color: 'var(--primary-red)', border: '2px solid var(--primary-red)' }}
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
            <h2 className="stats-title">历史记录</h2>
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
    </div>
  )
}

export default StatisticsPage

