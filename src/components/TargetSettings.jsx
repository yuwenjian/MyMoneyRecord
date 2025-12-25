import React, { useState, useEffect } from 'react'
import { getProfitTargets, saveProfitTarget, deleteProfitTarget } from '../utils/storage'
import toast from 'react-hot-toast'
import '../styles/TargetSettings.css'

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
      <div className="target-settings-modal">
        <div className="target-settings-content">
          <div className="target-settings-header">
            <h2>收益目标设置</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="loading">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="target-settings-modal" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className="target-settings-content">
        <div className="target-settings-header">
          <h2>收益目标设置</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="target-settings-body">
          {investmentTypes.map(({ value: invType, label: invLabel }) => (
            <div key={invType} className="target-type-section">
              <h3 className="target-type-title">{invLabel}收益目标</h3>
              {periods.map(({ value: period, label: periodLabel }) => {
                const target = getTarget(invType, period)
                const isEditing = editingTarget === `${invType}-${period}`
                
                return (
                  <div key={period} className="target-item">
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
                      <div className="target-display">
                        <div className="target-info">
                          <span className="target-period">{periodLabel}</span>
                          {target ? (
                            <>
                              <span className="target-amount">
                                目标: ¥{target.targetAmount.toLocaleString()}
                              </span>
                              {target.periodStartDate && (
                                <span className="target-date">
                                  周期: {target.periodStartDate}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="target-empty">未设置</span>
                          )}
                        </div>
                        <div className="target-actions">
                          <button
                            className="edit-btn"
                            onClick={() => setEditingTarget(`${invType}-${period}`)}
                          >
                            {target ? '编辑' : '设置'}
                          </button>
                          {target && (
                            <button
                              className="delete-btn"
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
    <form className="target-edit-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>{periodLabel}目标金额 (¥)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="请输入目标金额"
          required
        />
      </div>
      {period === 'week' && (
        <div className="form-group">
          <label>周期开始日期（周一）</label>
          <input
            type="date"
            value={periodStartDate}
            onChange={(e) => setPeriodStartDate(e.target.value)}
            placeholder="可选，默认为本周一"
          />
        </div>
      )}
      <div className="form-actions">
        <button type="submit" className="save-btn">保存</button>
        <button type="button" className="cancel-btn" onClick={onCancel}>取消</button>
      </div>
    </form>
  )
}

