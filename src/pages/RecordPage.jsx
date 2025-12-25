import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiPieChart, FiCamera, FiX } from 'react-icons/fi'
import { saveRecord, saveAdjustment, deleteAdjustmentByDate, getRecords, getAdjustments, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import { recognizeAccountData, recognizeMultipleImages } from '../utils/ocr'
import '../styles/RecordPage.css'

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
  const [uploadedImages, setUploadedImages] = useState([])
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [imagePreviews, setImagePreviews] = useState([])

  // 加载今日概览（当日期或投资类型改变时）
  useEffect(() => {
    loadTodayOverview()
  }, [formData.date, formData.investmentType])

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
      
      // 🆕 自动填充今日上证指数（如果已有记录）
      const todayWithShanghaiIndex = todayRecords.find(r => r.shanghaiIndex)
      if (todayWithShanghaiIndex && todayWithShanghaiIndex.shanghaiIndex) {
        setFormData(prev => ({
          ...prev,
          shanghaiIndex: todayWithShanghaiIndex.shanghaiIndex.toString()
        }))
        console.log('✅ 自动填充今日上证指数:', todayWithShanghaiIndex.shanghaiIndex)
      }
      
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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 处理图片上传（支持多张）
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // 验证文件类型和大小
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是图片文件`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 大小超过10MB`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // 添加到已上传列表
    const newImages = [...uploadedImages, ...validFiles]
    setUploadedImages(newImages)
    
    // 生成预览
    const newPreviews = []
    validFiles.forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        newPreviews.push({
          url: event.target.result,
          name: file.name,
          id: Date.now() + index
        })
        if (newPreviews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...newPreviews])
        }
      }
      reader.readAsDataURL(file)
    })

    // 清空文件输入，允许重新选择相同文件
    e.target.value = ''
  }

  // 批量识别所有图片
  const recognizeAllImages = async () => {
    if (uploadedImages.length === 0) {
      toast.error('请先上传图片')
      return
    }

    setIsRecognizing(true)
    const loadingToast = toast.loading(`正在识别 ${uploadedImages.length} 张图片...`)

    try {
      const result = await recognizeMultipleImages(uploadedImages, formData.investmentType)

      if (result.success && result.hasValidData) {
        // 自动填充识别到的数据
        const { data } = result
        setFormData(prev => ({
          ...prev,
          totalAsset: data.totalAsset ? data.totalAsset.toString() : prev.totalAsset,
          totalMarketValue: data.totalMarketValue ? data.totalMarketValue.toString() : prev.totalMarketValue,
          shanghaiIndex: data.shanghaiIndex ? data.shanghaiIndex.toString() : prev.shanghaiIndex
        }))

        const fields = []
        if (data.totalAsset) fields.push('总资产')
        if (data.totalMarketValue) fields.push('总市值')
        if (data.shanghaiIndex) fields.push('上证指数')

        toast.success(`识别成功！已自动填写: ${fields.join('、')}`, { id: loadingToast })
      } else {
        toast.error('未识别到有效数据，请手动输入', { id: loadingToast })
      }
    } catch (error) {
      console.error('批量识别错误:', error)
      toast.error('识别失败，请手动输入', { id: loadingToast })
    } finally {
      setIsRecognizing(false)
    }
  }

  // 删除指定图片
  const removeImage = (indexToRemove) => {
    setUploadedImages(prev => prev.filter((_, index) => index !== indexToRemove))
    setImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove))
  }

  // 清除所有图片
  const clearAllImages = () => {
    setUploadedImages([])
    setImagePreviews([])
    // 清空文件输入
    const fileInput = document.getElementById('image-upload')
    if (fileInput) fileInput.value = ''
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
          <div className="overview-card total-card no-click">
            <div className="overview-icon">
              <img src="/assets/images/zhichan.png" alt="总资产" />
            </div>
            <div className="overview-content">
              <div className="overview-label">总资产</div>
              <div className="overview-value-large">{todayOverview.totalAsset}</div>
            </div>
          </div>
          <div className="overview-card profit-card no-click">
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
          {/* 图片上传区域 */}
          <div className="image-upload-section">
            <div className="upload-header">
              <label className="form-label">
                <FiCamera style={{ marginRight: '6px' }} />
                智能识别 {imagePreviews.length > 0 && `(已上传 ${imagePreviews.length} 张)`}
              </label>
              <span className="upload-hint">可上传多张图片分别识别</span>
            </div>
            
            {imagePreviews.length === 0 ? (
              <label className="upload-box" htmlFor="image-upload">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  multiple
                />
                <div className="upload-icon">
                  <FiCamera size={32} />
                </div>
                <div className="upload-text">点击上传或拍照</div>
                <div className="upload-subtext">支持多张图片，JPG、PNG 等格式</div>
              </label>
            ) : (
              <div className="images-container">
                {/* 图片预览网格 */}
                <div className="images-grid">
                  {imagePreviews.map((preview, index) => (
                    <div key={preview.id || index} className="image-preview-item">
                      <img src={preview.url} alt={`预览${index + 1}`} className="preview-thumbnail" />
                      <button
                        type="button"
                        className="remove-image-btn"
                        onClick={() => removeImage(index)}
                        title="移除图片"
                      >
                        <FiX />
                      </button>
                      <div className="image-number">{index + 1}</div>
                    </div>
                  ))}
                  
                  {/* 添加更多按钮 */}
                  <label className="add-more-box" htmlFor="image-upload">
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      capture="environment"
                      multiple
                    />
                    <FiCamera size={24} />
                    <span>添加</span>
                  </label>
                </div>

                {/* 操作按钮 */}
                <div className="images-actions">
                  <button
                    type="button"
                    className="recognize-all-btn"
                    onClick={recognizeAllImages}
                    disabled={isRecognizing}
                  >
                    {isRecognizing ? '识别中...' : `识别全部 (${imagePreviews.length}张)`}
                  </button>
                  <button
                    type="button"
                    className="clear-all-btn"
                    onClick={clearAllImages}
                  >
                    清除全部
                  </button>
                </div>

                {isRecognizing && (
                  <div className="recognizing-status">
                    <div className="recognizing-spinner-small"></div>
                    <span>正在识别图片数据...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="new-date-section">
            <div className="date-field">
              <label className="form-label">日期</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="native-date-input"
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

