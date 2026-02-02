import React, { useState, useEffect } from 'react'
import { getProfitTargets, saveProfitTarget, deleteProfitTarget } from '../utils/storage'
import toast from 'react-hot-toast'

/**
 * 目标设置组件
 */
export function TargetSettings({ onClose, onUpdate }) {
  const [targets, setTargets] = useState([])
  const [editingTarget, setEditingTarget] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTargets()
  }, [])

  const loadTargets = async () => {
    try {
      setIsLoading(true)
      const allTargets = await getProfitTargets()
      setTargets(allTargets)
    } catch (error) {
      console.error('加载目标失败:', error)
      toast.error('加载目标失败')
    } finally {
      setIsLoading(false)
    }
  }

  const getTargetKey = (investmentType, period) => {
    return `${investmentType}-${period}`
  }

  const getTarget = (investmentType, period) => {
    return targets.find(t => 
      t.investmentType === investmentType && t.period === period
    )
  }

  const handleSave = async (investmentType, period, targetAmount, periodStartDate) => {
    try {
      const existing = getTarget(investmentType, period)
      
      // 验证目标金额
      const amount = parseFloat(targetAmount)
      if (isNaN(amount) || amount <= 0) {
        toast.error('请输入有效的目标金额（必须大于0）')
        return
      }

      const targetData = {
        objectId: existing?.objectId,
        investmentType,
        period,
        targetAmount: amount,
        periodStartDate: period === 'week' ? (periodStartDate || null) : null
      }

      await saveProfitTarget(targetData)
      toast.success('目标保存成功')
      await loadTargets()
      setEditingTarget(null)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('保存目标失败:', error)
      const errorMessage = error.message || '保存目标失败'
      toast.error(errorMessage)
    }
  }

  const handleDelete = async (objectId) => {
    if (!window.confirm('确定要删除这个目标吗？')) {
      return
    }

    try {
      await deleteProfitTarget(objectId)
      toast.success('目标删除成功')
      await loadTargets()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('删除目标失败:', error)
      toast.error('删除目标失败')
    }
  }

  const periods = [
    { value: 'week', label: '每周' },
    { value: 'month', label: '每月' },
    { value: 'year', label: '每年' }
  ]

  const investmentTypes = [
    { value: 'stock', label: '股票' },
    { value: 'fund', label: '基金' }
  ]

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 sm:p-5">
        <div className="bg-dark-surface rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-dark-border overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-5 lg:p-6 border-b border-dark-border bg-dark-elevated">
            <h2 className="text-base sm:text-lg lg:text-xl font-display font-bold text-amber-400">收益目标设置</h2>
            <button 
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-dark-surface text-gray-400 hover:text-amber-400 transition-all duration-300" 
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-10 text-gray-400 text-sm sm:text-base">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 sm:p-5" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className="bg-dark-surface rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-dark-border overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 lg:p-6 border-b border-dark-border bg-dark-elevated">
          <h2 className="text-base sm:text-lg lg:text-xl font-display font-bold text-amber-400">收益目标设置</h2>
          <button 
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg hover:bg-dark-surface text-gray-400 hover:text-amber-400 transition-all duration-300 text-xl sm:text-2xl" 
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-6 sm:space-y-8">
          {investmentTypes.map(({ value: invType, label: invLabel }) => (
            <div key={invType}>
              <h3 className="text-sm sm:text-base lg:text-lg font-display font-bold mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 flex items-center gap-2" style={{ 
                borderColor: invType === 'stock' ? 'rgb(239, 68, 68)' : 'rgb(251, 191, 36)',
                color: invType === 'stock' ? 'rgb(239, 68, 68)' : 'rgb(251, 191, 36)'
              }}>
                <span className="w-0.5 h-4 sm:h-5 rounded-full" style={{ 
                  backgroundColor: invType === 'stock' ? 'rgb(239, 68, 68)' : 'rgb(251, 191, 36)'
                }}></span>
                {invLabel}收益目标
              </h3>
              <div className="space-y-3 sm:space-y-4">
                {periods.map(({ value: period, label: periodLabel }) => {
                  const target = getTarget(invType, period)
                  const isEditing = editingTarget === `${invType}-${period}`
                  
                  return (
                    <div key={period} className="bg-dark-elevated border border-dark-border rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-amber-500/30 transition-all duration-300">
                      {isEditing ? (
                        <TargetEditForm
                          investmentType={invType}
                          period={period}
                          periodLabel={periodLabel}
                          initialTarget={target}
                          onSave={(amount, startDate) => {
                            handleSave(invType, period, amount, startDate)
                          }}
                          onCancel={() => setEditingTarget(null)}
                        />
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 space-y-1 sm:space-y-1.5">
                            <span className="block text-sm sm:text-base font-sans font-semibold text-gray-200">{periodLabel}</span>
                            {target ? (
                              <>
                                <span className="block text-xs sm:text-sm text-gray-400">
                                  目标: <span className="text-amber-400 font-display font-bold">¥{target.targetAmount.toLocaleString()}</span>
                                </span>
                                {target.periodStartDate && (
                                  <span className="block text-xs text-gray-500">
                                    周期: {target.periodStartDate}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="block text-xs sm:text-sm text-gray-500 italic">未设置</span>
                            )}
                          </div>
                          <div className="flex gap-2 sm:gap-2.5">
                            <button
                              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-dark-bg text-xs sm:text-sm font-sans font-semibold rounded-lg transition-all duration-300 shadow-glow-amber hover:scale-105 active:scale-95"
                              onClick={() => setEditingTarget(`${invType}-${period}`)}
                            >
                              {target ? '编辑' : '设置'}
                            </button>
                            {target && (
                              <button
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-dark-surface text-gray-400 hover:text-danger-light hover:border-danger-light text-xs sm:text-sm font-sans font-semibold rounded-lg border border-dark-border transition-all duration-300 hover:scale-105 active:scale-95"
                                onClick={() => handleDelete(target.objectId)}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 目标编辑表单
 */
function TargetEditForm({ investmentType, period, periodLabel, initialTarget, onSave, onCancel }) {
  const [targetAmount, setTargetAmount] = useState(
    initialTarget?.targetAmount?.toString() || ''
  )
  const [periodStartDate, setPeriodStartDate] = useState(
    initialTarget?.periodStartDate || ''
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const amount = parseFloat(targetAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('请输入有效的目标金额')
      return
    }
    onSave(amount, periodStartDate || null)
  }

  return (
    <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5 sm:space-y-2">
        <label className="block text-xs sm:text-sm font-sans font-semibold text-gray-300">
          {periodLabel}目标金额 (¥)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="请输入目标金额"
          className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-dark-surface border-2 border-dark-border text-gray-200 text-xs sm:text-sm rounded-lg sm:rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all duration-300 font-sans placeholder:text-gray-500"
          required
        />
      </div>
      {period === 'week' && (
        <div className="space-y-1.5 sm:space-y-2">
          <label className="block text-xs sm:text-sm font-sans font-semibold text-gray-300">
            周期开始日期（周一）
          </label>
          <input
            type="date"
            value={periodStartDate}
            onChange={(e) => setPeriodStartDate(e.target.value)}
            placeholder="可选，默认为本周一"
            className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-dark-surface border-2 border-dark-border text-gray-200 text-xs sm:text-sm rounded-lg sm:rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all duration-300 font-sans placeholder:text-gray-500"
          />
        </div>
      )}
      <div className="flex gap-2 sm:gap-2.5 pt-2">
        <button 
          type="submit" 
          className="flex-1 px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-dark-bg text-xs sm:text-sm font-sans font-semibold rounded-lg transition-all duration-300 shadow-glow-amber hover:scale-105 active:scale-95"
        >
          保存
        </button>
        <button 
          type="button" 
          className="flex-1 px-4 py-2 sm:py-2.5 bg-dark-surface text-gray-400 hover:text-gray-200 text-xs sm:text-sm font-sans font-semibold rounded-lg border border-dark-border hover:border-gray-500 transition-all duration-300 hover:scale-105 active:scale-95" 
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </form>
  )
}

