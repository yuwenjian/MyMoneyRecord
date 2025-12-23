import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker, { registerLocale } from 'react-datepicker'
import zhCN from 'date-fns/locale/zh-CN'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiPieChart } from 'react-icons/fi'
import { saveRecord, saveAdjustment, deleteAdjustmentByDate, getRecords, getAdjustments, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import 'react-datepicker/dist/react-datepicker.css'
import '../styles/RecordPage.css'

// 注册中文语言包
registerLocale('zh-CN', zhCN)
// 配置 dayjs
dayjs.extend(customParseFormat)
dayjs.locale('zh-cn')

function RecordPage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    investmentType: 'stock',
    totalAsset: '',
    totalMarketValue: '',
    adjustmentType: 'none',
    adjustmentAmountAdd: '',
    adjustmentAmountReduce: '',
    shanghaiIndex: '',
    notes: ''
  })
  const [todayOverview, setTodayOverview] = useState({
    totalAsset: '--',
    todayProfit: '--',
    stockAsset: '--',
    fundAsset: '--'
  })
  const [isLoading, setIsLoading] = useState(false)

  // 自定义输入组件，防止手机端弹出键盘
  const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
    <input
      value={value}
      onClick={onClick}
      ref={ref}
      readOnly
      className="new-picker-input"
      placeholder="请选择日期"
    />
  ));

  // 加载今日概览
  useEffect(() => {
    loadTodayOverview()
  }, [])

  const loadTodayOverview = async () => {
    try {
      const records = await getRecords()
      const adjustments = await getAdjustments()
      
      if (records.length === 0) {
        setTodayOverview({
          totalAsset: formatCurrency(0),
          todayProfit: formatCurrency(0, true),
          stockAsset: formatCurrency(0),
          fundAsset: formatCurrency(0)
        })
        return
      }

      const sortedRecords = [...records].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      const today = dayjs().format('YYYY-MM-DD')
      
      // 获取今日记录
      const todayRecords = sortedRecords.filter(r => r.date === today)
      const todayStockRecord = todayRecords.find(r => r.investmentType === 'stock')
      const todayFundRecord = todayRecords.find(r => r.investmentType === 'fund')
      
      // 获取最新记录
      const latestStockRecord = sortedRecords.filter(r => r.investmentType === 'stock')
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]
      const latestFundRecord = sortedRecords.filter(r => r.investmentType === 'fund')
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0]

      const stockAsset = latestStockRecord ? (latestStockRecord.totalAsset || 0) : 0
      const fundAsset = latestFundRecord ? (latestFundRecord.totalAsset || 0) : 0
      const totalAsset = stockAsset + fundAsset

      // 计算今日盈亏
      let todayProfit = 0
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

      setTodayOverview({
        totalAsset: formatCurrency(totalAsset),
        todayProfit: formatCurrency(todayProfit, true),
        stockAsset: formatCurrency(stockAsset),
        fundAsset: formatCurrency(fundAsset)
      })
    } catch (error) {
      console.error('加载今日概览失败:', error)
    }
  }

  const handleDateChange = (date) => {
    if (date) {
      const formattedDate = dayjs(date).format('YYYY-MM-DD')
      setFormData(prev => ({ ...prev, date: formattedDate }))
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    const { date, investmentType, totalAsset, totalMarketValue, adjustmentType, 
            adjustmentAmountAdd, adjustmentAmountReduce, shanghaiIndex, notes } = formData

    if (!totalAsset || !date) {
      toast.error('请填写总资产和日期')
      return
    }

    if (parseFloat(totalAsset) <= 0) {
      toast.error('总资产必须大于0')
      return
    }

    if (investmentType === 'stock' && (!totalMarketValue || parseFloat(totalMarketValue) <= 0)) {
      toast.error('请填写总市值')
      return
    }

    if (adjustmentType !== 'none') {
      const amount = adjustmentType === 'add' 
        ? parseFloat(adjustmentAmountAdd) 
        : parseFloat(adjustmentAmountReduce)
      
      if (!amount || amount === 0) {
        toast.error('请填写加减仓金额')
        return
      }
    }
    
    const loadingToast = toast.loading('正在保存...')
    
    try {
      const record = {
        date,
        totalAsset: parseFloat(totalAsset),
        totalMarketValue: investmentType === 'stock' ? parseFloat(totalMarketValue) : null,
        investmentType,
        shanghaiIndex: shanghaiIndex ? parseFloat(shanghaiIndex) : null,
        notes: notes || ''
      }

      await saveRecord(record)

      // 处理加减仓
      if (adjustmentType !== 'none') {
        const adjustment = {
          date,
          amount: adjustmentType === 'add' 
            ? parseFloat(adjustmentAmountAdd) 
            : -parseFloat(adjustmentAmountReduce),
          notes: notes || '',
          investmentType: investmentType
        }
        await saveAdjustment(adjustment)
      } else {
        // 如果选择无操作，删除该日期和投资类型的加减仓记录（如果存在）
        await deleteAdjustmentByDate(date, investmentType)
      }

      // 清空表单
      setFormData({
        date: dayjs().format('YYYY-MM-DD'),
        investmentType: 'stock',
        totalAsset: '',
        totalMarketValue: '',
        adjustmentType: 'none',
        adjustmentAmountAdd: '',
        adjustmentAmountReduce: '',
        shanghaiIndex: '',
        notes: ''
      })

      toast.success('记录已保存', { id: loadingToast })
    } catch (error) {
      toast.error(`保存失败: ${error.message || error.toString()}`, { id: loadingToast })
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>投资收益记录</h1>
      </header>

      <main className="app-main">
        {/* 今日概览卡片 */}
        <div className="today-overview-section">
          <div className="overview-card total-card">
            <div className="overview-icon">
              <FiDollarSign />
            </div>
            <div className="overview-content">
              <div className="overview-label">总资产</div>
              <div className="overview-value-large">{todayOverview.totalAsset}</div>
            </div>
          </div>
          <div className="overview-card profit-card">
            <div className="overview-icon">
              {parseFloat(todayOverview.todayProfit.replace(/,/g, '')) >= 0 ? (
                <FiTrendingUp />
              ) : (
                <FiTrendingDown />
              )}
            </div>
            <div className="overview-content">
              <div className="overview-label">今日盈亏</div>
              <div className={`overview-value-large ${parseFloat(todayOverview.todayProfit.replace(/,/g, '')) >= 0 ? 'profit' : 'loss'}`}>
                {todayOverview.todayProfit}
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="new-date-section">
            <div className="date-field">
              <label className="form-label">日期</label>
              <DatePicker
                selected={dayjs(formData.date).toDate()}
                onChange={handleDateChange}
                dateFormat="yyyy年MM月dd日"
                locale="zh-CN"
                customInput={<CustomInput />}
                wrapperClassName="new-picker-wrapper"
                popperClassName="new-calendar-popper"
              />
            </div>
            <button
              className="new-stats-btn"
              onClick={() => navigate('/statistics')}
            >
              统计分析
            </button>
          </div>

          {/* 投资类型 */}
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

          {/* 总资产 */}
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
            />
          </div>

          {/* 总市值（仅股票显示） */}
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
              />
            </div>
          )}

          {/* 加减仓操作 */}
          <div className="form-row">
            <label className="form-label">加减仓操作</label>
            <div className="radio-group vertical">
              <label className="radio-option-btn" data-value="none">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="none"
                  checked={formData.adjustmentType === 'none'}
                  onChange={handleInputChange}
                />
                <span className="radio-dot"></span>
                <span className="radio-label">无操作</span>
              </label>
              <div className="adjustment-option-wrapper">
                <label className="radio-option-btn add-position" data-value="add">
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="add"
                    checked={formData.adjustmentType === 'add'}
                    onChange={handleInputChange}
                  />
                  <span className="radio-dot"></span>
                  <span className="radio-label">+ 加仓</span>
                </label>
                {formData.adjustmentType === 'add' && (
                  <input
                    type="number"
                    name="adjustmentAmountAdd"
                    value={formData.adjustmentAmountAdd}
                    onChange={handleInputChange}
                    step="0.01"
                    className="form-input adjustment-amount-input show"
                    placeholder="请输入金额"
                  />
                )}
              </div>
              <div className="adjustment-option-wrapper">
                <label className="radio-option-btn reduce-position" data-value="reduce">
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="reduce"
                    checked={formData.adjustmentType === 'reduce'}
                    onChange={handleInputChange}
                  />
                  <span className="radio-dot"></span>
                  <span className="radio-label">- 减仓</span>
                </label>
                {formData.adjustmentType === 'reduce' && (
                  <input
                    type="number"
                    name="adjustmentAmountReduce"
                    value={formData.adjustmentAmountReduce}
                    onChange={handleInputChange}
                    step="0.01"
                    className="form-input adjustment-amount-input show"
                    placeholder="请输入金额"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 其他信息分组 */}
          <div className="form-section">
            <div className="form-section-title">
              <span>其他信息</span>
            </div>
            
            {/* 上证指数 */}
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

            {/* 备注 */}
            <div className="form-row">
              <label className="form-label">投资心得</label>
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="form-input"
                placeholder="可选"
              />
            </div>
          </div>
        </div>

        <button className="save-btn" onClick={handleSave}>
          保存记录
        </button>
      </main>
    </div>
  )
}

export default RecordPage

