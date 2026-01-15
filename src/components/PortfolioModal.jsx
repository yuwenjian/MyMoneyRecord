import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Input } from './ui'
import { getHoldings, saveHolding, deleteHolding, formatCurrency } from '../utils/storage'
import { recognizeHoldingsList } from '../utils/ocr'
import toast from 'react-hot-toast'

/**
 * 持仓管理弹窗组件
 * @param {boolean} isOpen - 是否显示弹窗
 * @param {Function} onClose - 关闭弹窗的回调
 */
export function PortfolioModal({ isOpen, onClose }) {
  const [holdings, setHoldings] = useState({
    stock: [],
    fund: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    cost: '',
    currentPrice: '',
    notes: ''
  })
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      loadHoldings()
    } else {
      // 关闭弹窗时清理状态
      setImagePreview(null)
      setEditingItem(null)
      setFormData({
        name: '',
        amount: '',
        cost: '',
        currentPrice: '',
        notes: ''
      })
    }
  }, [isOpen])

  // 监听粘贴事件（仅在弹窗打开时）
  useEffect(() => {
    if (isOpen) {
      const handlePasteEvent = (e) => {
        handlePaste(e)
      }
      window.addEventListener('paste', handlePasteEvent)
      return () => {
        window.removeEventListener('paste', handlePasteEvent)
      }
    }
  }, [isOpen])

  // 从 LeanCloud 加载持仓信息
  const loadHoldings = async () => {
    try {
      setIsLoading(true)
      
      // 分别获取股票和基金的持仓
      const [stockHoldings, fundHoldings] = await Promise.all([
        getHoldings('stock'),
        getHoldings('fund')
      ])

      setHoldings({
        stock: stockHoldings,
        fund: fundHoldings
      })
    } catch (error) {
      console.error('加载持仓失败:', error)
      toast.error('加载持仓信息失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAdd = (type) => {
    setEditingItem({ type, id: null })
    setFormData({
      name: '',
      amount: '',
      cost: '',
      currentPrice: '',
      notes: ''
    })
  }

  const handleEdit = (item, type) => {
    setEditingItem({ ...item, type })
    setFormData({
      name: item.name || '',
      amount: item.amount || '',
      cost: item.cost || '',
      currentPrice: item.currentPrice || '',
      notes: item.notes || ''
    })
  }

  const handleCancel = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      amount: '',
      cost: '',
      currentPrice: '',
      notes: ''
    })
  }

  const handleSave = async (type) => {
    try {
      if (!formData.name || !formData.amount) {
        toast.error('请填写名称和数量')
        return
      }

      // 保存到 LeanCloud
      const savedHolding = await saveHolding({
        id: editingItem?.id || null,
        name: formData.name,
        amount: parseFloat(formData.amount) || 0,
        cost: parseFloat(formData.cost) || 0,
        currentPrice: parseFloat(formData.currentPrice) || 0,
        notes: formData.notes || '',
        investmentType: type
      })

      // 更新本地状态
      const updatedHoldings = [...holdings[type]]
      
      if (editingItem?.id) {
        // 更新
        const index = updatedHoldings.findIndex(h => h.id === editingItem.id)
        if (index >= 0) {
          updatedHoldings[index] = savedHolding
        }
      } else {
        // 新增
        updatedHoldings.push(savedHolding)
      }

      setHoldings(prev => ({
        ...prev,
        [type]: updatedHoldings
      }))

      setEditingItem(null)
      setFormData({
        name: '',
        amount: '',
        cost: '',
        currentPrice: '',
        notes: ''
      })

      toast.success(editingItem?.id ? '更新成功' : '添加成功')
    } catch (error) {
      console.error('保存持仓失败:', error)
      toast.error(error.message || '保存失败')
    }
  }

  const handleDelete = async (item, type) => {
    if (!window.confirm(`确定要删除 "${item.name}" 吗？`)) {
      return
    }

    try {
      // 从 LeanCloud 删除
      await deleteHolding(item.id)

      // 更新本地状态
      const updatedHoldings = holdings[type].filter(h => h.id !== item.id)
      setHoldings(prev => ({
        ...prev,
        [type]: updatedHoldings
      }))

      toast.success('删除成功')
    } catch (error) {
      console.error('删除持仓失败:', error)
      toast.error(error.message || '删除失败')
    }
  }

  const calculateTotalValue = (type) => {
    return holdings[type].reduce((sum, item) => {
      const value = item.currentPrice > 0 
        ? item.currentPrice * item.amount 
        : item.cost * item.amount
      return sum + value
    }, 0)
  }

  const calculateTotalCost = (type) => {
    return holdings[type].reduce((sum, item) => {
      return sum + (item.cost * item.amount)
    }, 0)
  }

  const calculateProfit = (type) => {
    return calculateTotalValue(type) - calculateTotalCost(type)
  }

  // 处理图片上传
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
      recognizeHoldingsImage(file)
    }
    reader.readAsDataURL(file)
  }

  // 识别持仓列表图片
  const recognizeHoldingsImage = async (file, investmentType = null) => {
    try {
      setIsRecognizing(true)
      
      // 确定投资类型（优先使用传入的类型，否则根据当前编辑的持仓类型，最后默认为股票）
      const type = investmentType || editingItem?.type || 'stock'
      
      // 识别图片
      const result = await recognizeHoldingsList(file, type)
      
      if (result.success && result.holdings.length > 0) {
        // 股票持仓：总是批量处理（批量添加/更新）
        // 基金持仓：如果正在编辑单个持仓，填充表单；否则批量处理
        if (type === 'stock' || !editingItem) {
          // 批量保存所有识别的持仓（如果已存在则更新，不存在则新增）
          let successCount = 0
          let updateCount = 0
          let addCount = 0
          let failCount = 0
          
          // 先获取当前已有的持仓列表
          const currentHoldings = await getHoldings(type)
          
          for (const holding of result.holdings) {
            try {
              // 检查是否已存在同名持仓（支持模糊匹配）
              const existingHolding = currentHoldings.find(h => {
                const hName = h.name.trim()
                const holdingName = holding.name.trim()
                return hName === holdingName || 
                       hName.includes(holdingName) || 
                       holdingName.includes(hName) ||
                       // 支持部分匹配（至少3个字符相同）
                       (hName.length >= 3 && holdingName.length >= 3 && 
                        (hName.substring(0, 3) === holdingName.substring(0, 3) ||
                         hName.substring(hName.length - 3) === holdingName.substring(holdingName.length - 3)))
              })
              
              if (existingHolding) {
                // 更新已存在的持仓
                await saveHolding({
                  id: existingHolding.id, // 使用现有ID进行更新
                  name: existingHolding.name, // 保持原有名称（可能更完整）
                  amount: holding.amount,
                  cost: holding.cost,
                  currentPrice: holding.currentPrice,
                  notes: holding.notes || existingHolding.notes || '',
                  investmentType: type
                })
                updateCount++
                console.log(`  ✅ 更新持仓: ${existingHolding.name}`)
              } else {
                // 新增持仓
                await saveHolding({
                  name: holding.name,
                  amount: holding.amount,
                  cost: holding.cost,
                  currentPrice: holding.currentPrice,
                  notes: holding.notes || '',
                  investmentType: type
                })
                addCount++
                console.log(`  ✅ 新增持仓: ${holding.name}`)
              }
              successCount++
            } catch (error) {
              console.error('保存持仓失败:', error)
              failCount++
            }
          }
          
          // 重新加载持仓列表
          await loadHoldings()
          
          if (successCount > 0) {
            let message = `成功识别 ${successCount} 个持仓`
            if (updateCount > 0 && addCount > 0) {
              message += `（更新 ${updateCount} 个，新增 ${addCount} 个）`
            } else if (updateCount > 0) {
              message += `（更新 ${updateCount} 个）`
            } else if (addCount > 0) {
              message += `（新增 ${addCount} 个）`
            }
            if (failCount > 0) {
              message += `，${failCount} 个失败`
            }
            toast.success(message)
          } else {
            toast.error('识别成功但保存失败，请检查数据')
          }
        } else {
          // 基金持仓：编辑单个持仓时，填充表单
          const firstHolding = result.holdings[0]
          setFormData({
            name: firstHolding.name || '',
            amount: firstHolding.amount || '',
            cost: firstHolding.cost || '',
            currentPrice: firstHolding.currentPrice || '',
            notes: firstHolding.notes || ''
          })
          toast.success(`识别成功！已填充 ${result.holdings.length} 个持仓信息`)
        }
      } else {
        toast.error('未能识别到持仓信息，请确保图片清晰且包含持仓明细')
      }
    } catch (error) {
      console.error('识别失败:', error)
      toast.error(error.message || '识别失败，请重试')
    } finally {
      setIsRecognizing(false)
      setImagePreview(null)
    }
  }

  // 清除图片预览
  const handleClearImage = () => {
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 sm:p-4 bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-xl shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[95vh] flex flex-col my-auto">
        {/* 头部 */}
        <div 
          className="sticky top-0 left-0 right-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0 bg-white"
          style={{ 
            paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
            zIndex: 1000
          }}
        >
          <h2 className="text-xl sm:text-2xl font-bold text-gray-200 flex-1 mr-2 truncate">持仓管理</h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors bg-dark-elevated hover:bg-dark-surface active:bg-dark-border"
            style={{ 
              width: '44px', 
              height: '44px',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
            aria-label="关闭"
          >
            <span className="text-2xl leading-none text-gray-300 font-bold">×</span>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* 股票持仓 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <img src="/assets/images/gupiao.png" alt="股票" className="w-5 h-5 sm:w-6 sm:h-6" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">股票持仓</h3>
              </div>
              {!editingItem && (
                <Button
                  onClick={() => handleAdd('stock')}
                  size="sm"
                  className="text-xs sm:text-sm px-3 sm:px-4"
                >
                  + 新增持仓
                </Button>
              )}
            </div>

            {editingItem && editingItem.type === 'stock' ? (
              <Card className="mb-4">
                <div className="space-y-4">
                  {/* 图片识别功能 */}
                  <div className="border-2 border-dashed border-dark-border rounded-lg p-4 bg-dark-elevated/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">📷 图片识别</label>
                      {imagePreview && (
                        <button
                          onClick={handleClearImage}
                          className="text-danger-500 hover:text-danger-400 text-sm font-sans"
                        >
                          清除
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="stock-image-upload"
                      />
                      <label
                        htmlFor="stock-image-upload"
                        className="flex-1 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg cursor-pointer hover:bg-dark-elevated hover:border-amber-500/40 text-center text-sm text-gray-200 transition-colors"
                      >
                        {isRecognizing ? '识别中...' : '选择图片'}
                      </label>
                      <div className="text-xs text-gray-400 flex items-center">
                        或直接粘贴图片 (Ctrl+V)
                      </div>
                    </div>
                    {imagePreview && (
                      <div className="mt-3 relative">
                        <img
                          src={imagePreview}
                          alt="预览"
                          className="max-w-full h-auto rounded-lg border border-dark-border"
                        />
                      </div>
                    )}
                  </div>
                  
                  <Input
                    label="股票名称/代码"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="例如：贵州茅台 (600519)"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="持仓数量"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      placeholder="股数"
                      step="0.01"
                    />
                    <Input
                      type="number"
                      label="成本价"
                      name="cost"
                      value={formData.cost}
                      onChange={handleInputChange}
                      placeholder="元/股"
                      step="0.01"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="当前价"
                      name="currentPrice"
                      value={formData.currentPrice}
                      onChange={handleInputChange}
                      placeholder="元/股（可选）"
                      step="0.01"
                    />
                    <Input
                      label="备注"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="可选"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button
                      onClick={() => handleSave('stock')}
                      fullWidth
                      className="w-full sm:w-auto"
                    >
                      保存
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      fullWidth
                      className="w-full sm:w-auto"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {holdings.stock.length > 0 ? (
              <div className="space-y-2">
                {/* 表头 - 桌面端 */}
                <div className="hidden sm:grid grid-cols-6 gap-2 sm:gap-4 p-3 bg-dark-elevated rounded-lg text-xs sm:text-sm font-medium text-gray-300">
                  <div className="truncate">名称</div>
                  <div className="text-right">数量</div>
                  <div className="text-right hidden md:block">成本价</div>
                  <div className="text-right hidden md:block">当前价</div>
                  <div className="text-right">盈亏</div>
                  <div className="text-right">操作</div>
                </div>
                {holdings.stock.map((item) => {
                  const value = item.currentPrice > 0 ? item.currentPrice * item.amount : item.cost * item.amount
                  const profit = value - (item.cost * item.amount)
                  const profitPercent = item.cost > 0 ? (profit / (item.cost * item.amount)) * 100 : 0

                  return (
                    <div key={item.id}>
                      {/* 移动端布局 */}
                      <div className="sm:hidden p-3 border border-gray-200 rounded-lg bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm truncate flex-1 mr-2" title={item.name}>{item.name}</div>
                          <div className={`font-semibold text-sm whitespace-nowrap ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-gray-400">
                            {item.amount.toLocaleString()} 股
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(item, 'stock')}
                              className="text-xs px-3 py-1.5 bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/60 hover:text-amber-300"
                            >
                              ✏️ 编辑
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(item, 'stock')}
                              className="text-xs px-3 py-1.5 shadow-danger-base/30"
                            >
                              🗑️ 删除
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* 桌面端布局 */}
                      <div className="hidden sm:grid grid-cols-6 gap-2 sm:gap-4 p-3 border border-gray-200 rounded-lg items-center text-xs sm:text-sm">
                        <div className="font-medium truncate" title={item.name}>{item.name}</div>
                        <div className="text-right">{item.amount.toLocaleString()}</div>
                        <div className="text-right hidden md:block">{formatCurrency(item.cost)}</div>
                        <div className="text-right hidden md:block">{item.currentPrice > 0 ? formatCurrency(item.currentPrice) : '--'}</div>
                        <div className={`text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <div>{formatCurrency(profit, true)}</div>
                          <div className="text-xs">({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)</div>
                        </div>
                        <div className="flex justify-end space-x-1 sm:space-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(item, 'stock')}
                            className="text-xs px-2 bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/60 hover:text-amber-300"
                          >
                            ✏️ 编辑
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(item, 'stock')}
                            className="text-xs px-2 shadow-danger-base/30"
                          >
                            🗑️ 删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="mt-4 p-4 bg-dark-elevated rounded-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-sm">
                    <span className="font-medium text-gray-300">合计：</span>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <div className="flex justify-between sm:block">
                        <span className="sm:hidden text-gray-600">总市值：</span>
                        <span>{formatCurrency(calculateTotalValue('stock'))}</span>
                      </div>
                      <div className="flex justify-between sm:block mt-1">
                        <span className="sm:hidden text-gray-600">总成本：</span>
                        <span>{formatCurrency(calculateTotalCost('stock'))}</span>
                      </div>
                      <div className={`flex justify-between sm:block mt-1 font-semibold ${calculateProfit('stock') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="sm:hidden">总盈亏：</span>
                        <span>{formatCurrency(calculateProfit('stock'), true)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              !editingItem && (
                <div className="text-center py-8 text-gray-400">
                  <p>暂无股票持仓</p>
                  <p className="text-sm mt-2">点击"新增持仓"按钮添加</p>
                </div>
              )
            )}
          </div>

          {/* 基金持仓 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <img src="/assets/images/jijin.png" alt="基金" className="w-5 h-5 sm:w-6 sm:h-6" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">基金持仓</h3>
              </div>
              {!editingItem && (
                <Button
                  onClick={() => handleAdd('fund')}
                  size="sm"
                  className="text-xs sm:text-sm px-3 sm:px-4"
                >
                  + 新增持仓
                </Button>
              )}
            </div>

            {editingItem && editingItem.type === 'fund' ? (
              <Card className="mb-4">
                <div className="space-y-4">
                  {/* 图片识别功能 */}
                  <div className="border-2 border-dashed border-dark-border rounded-lg p-4 bg-dark-elevated/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">📷 图片识别</label>
                      {imagePreview && (
                        <button
                          onClick={handleClearImage}
                          className="text-danger-500 hover:text-danger-400 text-sm font-sans"
                        >
                          清除
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="fund-image-upload"
                      />
                      <label
                        htmlFor="fund-image-upload"
                        className="flex-1 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg cursor-pointer hover:bg-dark-elevated hover:border-amber-500/40 text-center text-sm text-gray-200 transition-colors"
                      >
                        {isRecognizing ? '识别中...' : '选择图片'}
                      </label>
                      <div className="text-xs text-gray-400 flex items-center">
                        或直接粘贴图片 (Ctrl+V)
                      </div>
                    </div>
                    {imagePreview && (
                      <div className="mt-3 relative">
                        <img
                          src={imagePreview}
                          alt="预览"
                          className="max-w-full h-auto rounded-lg border border-dark-border"
                        />
                      </div>
                    )}
                  </div>
                  
                  <Input
                    label="基金名称/代码"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="例如：易方达蓝筹精选 (005827)"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="持仓份额"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      placeholder="份额"
                      step="0.01"
                    />
                    <Input
                      type="number"
                      label="成本价"
                      name="cost"
                      value={formData.cost}
                      onChange={handleInputChange}
                      placeholder="元/份"
                      step="0.01"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="当前净值"
                      name="currentPrice"
                      value={formData.currentPrice}
                      onChange={handleInputChange}
                      placeholder="元/份（可选）"
                      step="0.01"
                    />
                    <Input
                      label="备注"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="可选"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => handleSave('fund')}
                      fullWidth
                    >
                      保存
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      fullWidth
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {holdings.fund.length > 0 ? (
              <div className="space-y-2">
                {/* 表头 - 桌面端 */}
                <div className="hidden sm:grid grid-cols-6 gap-2 sm:gap-4 p-3 bg-dark-elevated rounded-lg text-xs sm:text-sm font-medium text-gray-300">
                  <div className="truncate">名称</div>
                  <div className="text-right">份额</div>
                  <div className="text-right hidden md:block">成本价</div>
                  <div className="text-right hidden md:block">当前净值</div>
                  <div className="text-right">盈亏</div>
                  <div className="text-right">操作</div>
                </div>
                {holdings.fund.map((item) => {
                  const value = item.currentPrice > 0 ? item.currentPrice * item.amount : item.cost * item.amount
                  const profit = value - (item.cost * item.amount)
                  const profitPercent = item.cost > 0 ? (profit / (item.cost * item.amount)) * 100 : 0

                  return (
                    <div key={item.id}>
                      {/* 移动端布局 */}
                      <div className="sm:hidden p-3 border border-gray-200 rounded-lg bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm truncate flex-1 mr-2" title={item.name}>{item.name}</div>
                          <div className={`font-semibold text-sm whitespace-nowrap ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-gray-400">
                            {item.amount.toLocaleString()} 份
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(item, 'fund')}
                              className="text-xs px-3 py-1.5 bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/60 hover:text-amber-300"
                            >
                              ✏️ 编辑
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(item, 'fund')}
                              className="text-xs px-3 py-1.5 shadow-danger-base/30"
                            >
                              🗑️ 删除
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* 桌面端布局 */}
                      <div className="hidden sm:grid grid-cols-6 gap-2 sm:gap-4 p-3 border border-gray-200 rounded-lg items-center text-xs sm:text-sm">
                        <div className="font-medium truncate" title={item.name}>{item.name}</div>
                        <div className="text-right">{item.amount.toLocaleString()}</div>
                        <div className="text-right hidden md:block">{formatCurrency(item.cost)}</div>
                        <div className="text-right hidden md:block">{item.currentPrice > 0 ? formatCurrency(item.currentPrice) : '--'}</div>
                        <div className={`text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <div>{formatCurrency(profit, true)}</div>
                          <div className="text-xs">({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)</div>
                        </div>
                        <div className="flex justify-end space-x-1 sm:space-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(item, 'fund')}
                            className="text-xs px-2 bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/60 hover:text-amber-300"
                          >
                            ✏️ 编辑
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(item, 'fund')}
                            className="text-xs px-2 shadow-danger-base/30"
                          >
                            🗑️ 删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="mt-4 p-4 bg-dark-elevated rounded-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-sm">
                    <span className="font-medium text-gray-300">合计：</span>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <div className="flex justify-between sm:block">
                        <span className="sm:hidden text-gray-600">总市值：</span>
                        <span>{formatCurrency(calculateTotalValue('fund'))}</span>
                      </div>
                      <div className="flex justify-between sm:block mt-1">
                        <span className="sm:hidden text-gray-600">总成本：</span>
                        <span>{formatCurrency(calculateTotalCost('fund'))}</span>
                      </div>
                      <div className={`flex justify-between sm:block mt-1 font-semibold ${calculateProfit('fund') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="sm:hidden">总盈亏：</span>
                        <span>{formatCurrency(calculateProfit('fund'), true)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              !editingItem && (
                <div className="text-center py-8 text-gray-400">
                  <p>暂无基金持仓</p>
                  <p className="text-sm mt-2">点击"新增持仓"按钮添加</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

