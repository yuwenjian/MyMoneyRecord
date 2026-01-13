import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
// 已移除图标导入，使用文字符号代替
import { saveRecord, saveAdjustment, deleteAdjustmentByDate, getRecords, getAdjustments, formatCurrency } from '../utils/storage'
import { calculateDailyProfitLoss } from '../utils/calculations'
import { recognizeAccountData, recognizeMultipleImages } from '../utils/ocr'
import { PageHeader, Card, Button, Input } from '../components/ui'
// import '../styles/RecordPage.css' // 已迁移到 Tailwind CSS

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
      
      // 触发数据更新事件，通知概览页面可能需要重新生成AI分析
      window.dispatchEvent(new CustomEvent('dataUpdated', { 
        detail: { date, investmentType } 
      }))
    } catch (error) {
      toast.error(`保存失败: ${error.message || error.toString()}`, { id: loadingToast })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="创建收益记录"
        subtitle="记录每日投资数据，支持智能识别"
      />

      {/* 今日概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div>
            <div className="text-sm text-blue-100 mb-1">总资产</div>
            <div className="text-4xl lg:text-5xl font-bold">{todayOverview.totalAsset}</div>
          </div>
        </Card>
        <Card className={`${parseFloat(todayOverview.todayProfit.replace(/,/g, '')) >= 0 ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-red-600 to-red-700'} text-white`}>
          <div>
            <div className="text-sm text-white/80 mb-1">今日盈亏</div>
            <div className="text-4xl lg:text-5xl font-bold">{todayOverview.todayProfit}</div>
          </div>
        </Card>
      </div>

      <Card>
        {/* 图片上传区域 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-base font-semibold text-gray-800">
              智能识别 {imagePreviews.length > 0 && `(已上传 ${imagePreviews.length} 张)`}
            </label>
            <span className="text-sm text-gray-500">可上传多张图片分别识别</span>
          </div>
          
          {imagePreviews.length === 0 ? (
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 transition-colors"
            >
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                multiple
              />
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📷</span>
              </div>
              <div className="text-base font-medium text-gray-700 mb-1">点击上传或拍照</div>
              <div className="text-sm text-gray-500">支持多张图片，JPG、PNG 等格式</div>
            </label>
          ) : (
            <div className="space-y-4">
              {/* 图片预览网格 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={preview.id || index} className="relative group">
                    <img
                      src={preview.url}
                      alt={`预览${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm font-bold"
                      onClick={() => removeImage(index)}
                      title="移除图片"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-2 left-2 w-6 h-6 bg-black bg-opacity-50 text-white text-xs rounded-full flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>
                ))}
                
                {/* 添加更多按钮 */}
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    multiple
                  />
                  <span className="text-2xl mb-1">➕</span>
                  <span className="text-xs text-gray-500">添加</span>
                </label>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Button
                  onClick={recognizeAllImages}
                  disabled={isRecognizing}
                  fullWidth
                  className="w-full sm:flex-1"
                >
                  {isRecognizing ? '识别中...' : `识别全部 (${imagePreviews.length}张)`}
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearAllImages}
                  fullWidth
                  className="w-full sm:flex-1"
                >
                  清除全部
                </Button>
              </div>

              {isRecognizing && (
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>正在识别图片数据...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 日期选择 */}
        <div className="mb-6">
          <Input
            type="date"
            label="日期"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
          />
        </div>

        {/* 投资类型 */}
        <div className="mb-6">
          <label className="block text-base font-semibold text-gray-800 mb-3">投资类型</label>
          <div className="flex space-x-4">
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="investmentType"
                value="stock"
                checked={formData.investmentType === 'stock'}
                onChange={handleInputChange}
                className="hidden"
              />
              <div className={`
                flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                ${formData.investmentType === 'stock'
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-gray-300 bg-white hover:border-gray-400'
                }
              `}>
                <img
                  src={formData.investmentType === 'stock' ? '/assets/images/gupiao_white.png' : '/assets/images/gupiao.png'}
                  alt="股票"
                  className="w-8 h-8 mb-2"
                />
                <span className={`text-base font-medium ${formData.investmentType === 'stock' ? 'text-white' : 'text-gray-800'}`}>
                  股票
                </span>
              </div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="investmentType"
                value="fund"
                checked={formData.investmentType === 'fund'}
                onChange={handleInputChange}
                className="hidden"
              />
              <div className={`
                flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                ${formData.investmentType === 'fund'
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-white hover:border-gray-400'
                }
              `}>
                <img
                  src={formData.investmentType === 'fund' ? '/assets/images/jijin_white.png' : '/assets/images/jijin.png'}
                  alt="基金"
                  className="w-8 h-8 mb-2"
                />
                <span className={`text-base font-medium ${formData.investmentType === 'fund' ? 'text-white' : 'text-gray-800'}`}>
                  基金
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* 总资产 */}
        <div className="mb-6">
          <Input
            type="number"
            name="totalAsset"
            label="总资产"
            value={formData.totalAsset}
            onChange={handleInputChange}
            step="0.01"
            placeholder="请输入总资产"
          />
        </div>

        {/* 总市值（仅股票显示） */}
        {formData.investmentType === 'stock' && (
          <div className="mb-6">
            <Input
              type="number"
              name="totalMarketValue"
              label="总市值"
              value={formData.totalMarketValue}
              onChange={handleInputChange}
              step="0.01"
              placeholder="请输入总市值"
            />
          </div>
        )}

        {/* 加减仓操作 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">加减仓操作</label>
          <div className="space-y-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="adjustmentType"
                value="none"
                checked={formData.adjustmentType === 'none'}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-base text-gray-800">无操作</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="add"
                  checked={formData.adjustmentType === 'add'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                />
                <span className="ml-2 text-base text-gray-800">+ 加仓</span>
              </label>
              {formData.adjustmentType === 'add' && (
                <Input
                  type="number"
                  name="adjustmentAmountAdd"
                  value={formData.adjustmentAmountAdd}
                  onChange={handleInputChange}
                  step="0.01"
                  placeholder="请输入金额"
                  className="ml-6"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustmentType"
                  value="reduce"
                  checked={formData.adjustmentType === 'reduce'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-base text-gray-800">- 减仓</span>
              </label>
              {formData.adjustmentType === 'reduce' && (
                <Input
                  type="number"
                  name="adjustmentAmountReduce"
                  value={formData.adjustmentAmountReduce}
                  onChange={handleInputChange}
                  step="0.01"
                  placeholder="请输入金额"
                  className="ml-6"
                />
              )}
            </div>
          </div>
        </div>

        {/* 其他信息 */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">其他信息</h3>
          <div className="space-y-4">
            <Input
              type="number"
              name="shanghaiIndex"
              label="上证指数"
              value={formData.shanghaiIndex}
              onChange={handleInputChange}
              step="0.01"
              placeholder="请输入上证指数"
            />
            <Input
              type="text"
              name="notes"
              label="投资心得"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="可选"
            />
          </div>
        </div>
      </Card>

      <Button
        onClick={handleSave}
        fullWidth
        size="lg"
      >
        保存记录
      </Button>
    </div>
  )
}

export default RecordPage


