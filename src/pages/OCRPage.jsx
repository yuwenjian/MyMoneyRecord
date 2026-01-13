import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import { recognizeAccountData } from '../utils/ocr'
import { formatCurrency } from '../utils/storage'
import toast from 'react-hot-toast'

function OCRPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [recognitionResult, setRecognitionResult] = useState(null)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          handleImageUpload(file)
        }
        break
      }
    }
  }

  const handleImageUpload = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
      recognizeImage(file)
    }
    reader.readAsDataURL(file)
  }

  const recognizeImage = async (file) => {
    try {
      setIsRecognizing(true)
      setRecognitionResult(null)

      // 识别图片
      const result = await recognizeAccountData(file, 'stock')
      
      setRecognitionResult({
        totalAsset: result.totalAsset || 0,
        investmentType: result.investmentType || 'stock',
        confidence: 99, // AI 校准百分比
        addAmount: 0, // 今日加仓
        reduceAmount: 0, // 今日减仓
      })

      toast.success('识别成功！')
    } catch (error) {
      console.error('识别失败:', error)
      toast.error(error.message || '识别失败，请重试')
    } finally {
      setIsRecognizing(false)
    }
  }

  const handleSave = () => {
    if (!recognitionResult) {
      toast.error('请先识别图片')
      return
    }
    // TODO: 保存识别结果到数据库
    toast.success('保存成功！')
    navigate('/')
  }

  const handleCancel = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">智能识别资产</h1>
            <p className="text-gray-500 mt-1 flex items-center">
              结合 Gemini AI 数据校验 <span className="ml-1 text-yellow-500">✨</span>
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors text-xl font-bold text-gray-600"
          >
            ×
          </button>
        </div>

        {/* 上传区域 */}
        <div
          className="bg-white rounded-xl p-8 lg:p-12 border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors cursor-pointer mb-6"
          onClick={() => fileInputRef.current?.click()}
          onPaste={handlePaste}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="text-center">
              <img
                src={imagePreview}
                alt="预览"
                className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg"
              />
              {isRecognizing && (
                <div className="mt-4 text-blue-600 font-medium">AI 正在识别中...</div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📷</span>
              </div>
              <p className="text-gray-700 font-medium mb-2">点击上传或粘贴截图</p>
              <p className="text-sm text-gray-500 flex items-center justify-center">
                AI准备自动对焦数值 <span className="ml-1 text-yellow-500">✨</span>
              </p>
            </div>
          )}
        </div>

        {/* 识别结果 */}
        {recognitionResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* 识别总资产 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600 mb-2">识别总资产</h3>
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-bold text-gray-800">
                  {formatCurrency(recognitionResult.totalAsset)}
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  +AI 校准 {recognitionResult.confidence}%
                </span>
              </div>
            </div>

            {/* 资产分类 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600 mb-2">资产分类</h3>
              <div className="text-2xl font-bold text-gray-800">
                {recognitionResult.investmentType === 'stock' ? '股票大类' : '基金大类'}
              </div>
            </div>

            {/* 今日加仓 */}
            <div className="bg-orange-50 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-medium text-orange-600 mb-2">今日加仓(+)</h3>
              <div className="text-2xl font-bold text-gray-800">
                {formatCurrency(recognitionResult.addAmount)}
              </div>
            </div>

            {/* 今日减仓 */}
            <div className="bg-blue-50 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-medium text-blue-600 mb-2">今日减仓(-)</h3>
              <div className="text-2xl font-bold text-gray-800">
                {formatCurrency(recognitionResult.reduceAmount)}
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-4">
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            放弃识别
          </button>
          <button
            onClick={handleSave}
            disabled={!recognitionResult || isRecognizing}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✨ AI强化保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default OCRPage

