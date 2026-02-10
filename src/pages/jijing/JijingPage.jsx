import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader, Card, Button, Input } from '../../components/ui'
import { fetchFundEstimations } from './fundApi'
import { getHoldings, formatCurrency } from '../../utils/storage'
import toast from 'react-hot-toast'
import { FiRefreshCw, FiPlus, FiTrash2, FiTrendingUp } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'jijing_fund_codes'

function loadFundCodes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((c) => String(c).trim()) : []
  } catch {
    return []
  }
}

function saveFundCodes(codes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(codes))
}

export default function JijingPage() {
  const [fundCodes, setFundCodes] = useState(loadFundCodes)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [adding, setAdding] = useState(false)
  // 我的持仓 + 今日预估收益
  const [holdingsWithEstimate, setHoldingsWithEstimate] = useState([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [holdingsRefreshing, setHoldingsRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (fundCodes.length === 0) {
      setList([])
      return
    }
    setLoading(true)
    try {
      const data = await fetchFundEstimations(fundCodes)
      setList(data)
    } catch (e) {
      toast.error(e.message || '加载估值失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [fundCodes])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 加载「我的持仓」并拉取估值，计算今日预估收益
  const loadHoldingsEstimate = useCallback(async () => {
    setHoldingsLoading(true)
    try {
      const all = await getHoldings('fund')
      const withCode = all.filter((h) => h.fundCode && String(h.fundCode).trim())
      if (withCode.length === 0) {
        setHoldingsWithEstimate([])
        setHoldingsLoading(false)
        return
      }
      const codes = [...new Set(withCode.map((h) => String(h.fundCode).trim()))]
      const estimations = await fetchFundEstimations(codes)
      const map = new Map(estimations.map((e) => [e.fundcode, e]))
      const merged = withCode.map((h) => {
        const est = map.get(String(h.fundCode).trim())
        const dwjz = est && est.dwjz !== '—' ? parseFloat(est.dwjz) : 0
        const gszzl = est && est.gszzl != null ? est.gszzl : null
        const todayEstimate = dwjz > 0 && gszzl != null ? h.amount * dwjz * (gszzl / 100) : null
        const gsz = est && est.gsz !== '—' ? parseFloat(est.gsz) : null
        const marketValueByGsz = gsz != null ? h.amount * gsz : null
        return {
          ...h,
          estimation: est,
          todayEstimate,
          marketValueByGsz
        }
      })
      setHoldingsWithEstimate(merged)
    } catch (e) {
      console.error(e)
      setHoldingsWithEstimate([])
    } finally {
      setHoldingsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHoldingsEstimate()
  }, [loadHoldingsEstimate])

  const handleRefreshHoldings = async () => {
    setHoldingsRefreshing(true)
    try {
      await loadHoldingsEstimate()
      toast.success('持仓估值已刷新')
    } catch (e) {
      toast.error(e.message || '刷新失败')
    } finally {
      setHoldingsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    if (fundCodes.length === 0) return
    setRefreshing(true)
    try {
      const data = await fetchFundEstimations(fundCodes)
      setList(data)
      toast.success('已刷新估值')
    } catch (e) {
      toast.error(e.message || '刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const handleAdd = () => {
    const code = String(inputCode).trim().replace(/\s/g, '')
    if (!code) {
      toast.error('请输入基金代码')
      return
    }
    if (fundCodes.includes(code)) {
      toast.error('该基金已在列表中')
      return
    }
    setAdding(true)
    const next = [...fundCodes, code]
    setFundCodes(next)
    saveFundCodes(next)
    setInputCode('')
    toast.success('已添加，正在拉取估值…')
    setAdding(false)
    loadData()
  }

  const handleRemove = (code) => {
    const next = fundCodes.filter((c) => c !== code)
    setFundCodes(next)
    saveFundCodes(next)
    setList((prev) => prev.filter((i) => i.fundcode !== code))
    toast.success('已移除')
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <PageHeader
        title="基金"
        subtitle="实时估值与今日预估涨幅（数据仅供参考，以基金公司公布净值为准）"
        actions={
          <Button
            onClick={handleRefresh}
            disabled={loading || refreshing || fundCodes.length === 0}
            className="inline-flex items-center gap-2"
          >
            {refreshing ? (
              <>
                <FiRefreshCw className="w-4 h-4 animate-spin" />
                刷新中…
              </>
            ) : (
              <>
                <FiRefreshCw className="w-4 h-4" />
                刷新
              </>
            )}
          </Button>
        }
      />

      {/* 我的持仓 · 今日预估收益 */}
      <Card hover className="animate-stagger-2">
        <h3 className="text-lg sm:text-xl font-display font-bold text-amber-400 mb-2 flex items-center gap-2">
          <span className="w-0.5 h-4 sm:h-5 bg-amber-400 rounded-full" />
          我的持仓 · 今日预估收益
        </h3>
        <p className="text-sm text-gray-300 mb-4">
          在「<Link to="/portfolio" className="text-amber-400 hover:text-amber-300 underline font-medium">配置</Link>」中录入基金代码与持仓份额后，此处显示按实时估值计算的今日预估收益。
        </p>
        {holdingsLoading && holdingsWithEstimate.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-300">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-base">加载持仓与估值…</p>
          </div>
        ) : holdingsWithEstimate.length === 0 ? (
          <div className="py-8 text-center text-gray-300 rounded-xl bg-dark-elevated/50 border border-dark-border/50">
            <p className="text-base font-medium">暂无带基金代码的持仓</p>
            <p className="text-sm mt-1 text-gray-300">请先在「配置」中添加基金持仓并填写 6 位基金代码</p>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-400 hover:text-amber-300"
            >
              <FiTrendingUp className="w-4 h-4" />
              去配置
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRefreshHoldings}
                disabled={holdingsRefreshing}
                className="inline-flex items-center gap-1.5"
              >
                {holdingsRefreshing ? (
                  <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FiRefreshCw className="w-3.5 h-3.5" />
                )}
                刷新
              </Button>
            </div>
            {/* 移动端：卡片布局 */}
            <div className="md:hidden space-y-3">
              {holdingsWithEstimate.map((h) => (
                <div
                  key={h.id}
                  className="bg-dark-surface/80 border border-dark-border/60 rounded-xl p-4 hover:bg-dark-elevated transition-colors"
                >
                  {/* 基金名称 */}
                  <div className="mb-3 pb-3 border-b border-dark-border/40">
                    <div className="font-sans font-semibold text-white text-base">{h.name}</div>
                    <div className="text-sm text-gray-400 mt-1">{h.fundCode}</div>
                  </div>
                  
                  {/* 关键指标：今日预估收益 + 涨幅 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-300">今日预估收益</span>
                    <div className="flex items-center gap-2">
                      {h.todayEstimate != null ? (
                        <span
                          className={`font-sans font-bold text-lg ${
                            h.todayEstimate >= 0 ? 'text-danger-light' : 'text-success-light'
                          }`}
                        >
                          {formatCurrency(h.todayEstimate, true)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {h.estimation?.gszzl != null && (
                        <span
                          className={`font-sans font-semibold text-sm px-2 py-0.5 rounded ${
                            h.estimation.gszzl >= 0 
                              ? 'bg-danger-base/20 text-danger-light' 
                              : 'bg-success-base/20 text-success-light'
                          }`}
                        >
                          {h.estimation.gszzl >= 0 ? '+' : ''}{h.estimation.gszzl}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* 详细信息网格 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">份额</span>
                      <span className="text-white font-medium">{h.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">单位净值</span>
                      <span className="text-white font-medium">{h.estimation?.dwjz ?? '—'}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-gray-400">估值</span>
                      <span className="text-amber-400 font-semibold">{h.estimation?.gsz ?? '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 桌面端：表格布局 */}
            <div className="hidden md:block overflow-x-auto -mx-2">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="text-left text-sm sm:text-base text-gray-200 border-b-2 border-dark-border">
                    <th className="pb-3 pr-2 font-sans font-semibold">基金</th>
                    <th className="pb-3 pr-2 font-sans font-semibold text-right">份额</th>
                    <th className="pb-3 pr-2 font-sans font-semibold text-right">单位净值</th>
                    <th className="pb-3 pr-2 font-sans font-semibold text-right">估值</th>
                    <th className="pb-3 pr-2 font-sans font-semibold text-right">今日涨幅</th>
                    <th className="pb-3 pr-2 font-sans font-semibold text-right">今日预估收益</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsWithEstimate.map((h) => (
                    <tr
                      key={h.id}
                      className="border-b border-dark-border/60 bg-dark-surface/80 hover:bg-dark-elevated transition-colors"
                    >
                      <td className="py-4 pr-2">
                        <div className="font-sans font-semibold text-white text-sm sm:text-base">{h.name}</div>
                        <div className="text-sm text-gray-400 mt-0.5">{h.fundCode}</div>
                      </td>
                      <td className="py-4 pr-2 text-right font-sans text-white font-semibold text-sm sm:text-base">{h.amount.toLocaleString()}</td>
                      <td className="py-4 pr-2 text-right font-sans text-white font-semibold text-sm sm:text-base">
                        {h.estimation?.dwjz ?? '—'}
                      </td>
                      <td className="py-4 pr-2 text-right font-sans text-amber-400 font-semibold text-sm sm:text-base">
                        {h.estimation?.gsz ?? '—'}
                      </td>
                      <td className="py-4 pr-2 text-right text-sm sm:text-base">
                        {h.estimation?.error ? (
                          <span className="text-gray-400">{h.estimation.error}</span>
                        ) : h.estimation?.gszzl != null ? (
                          <span
                            className={`font-sans font-semibold ${
                              h.estimation.gszzl >= 0 ? 'text-danger-light' : 'text-success-light'
                            }`}
                          >
                            {h.estimation.gszzl >= 0 ? '+' : ''}{h.estimation.gszzl}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-4 pr-2 text-right text-sm sm:text-base">
                        {h.todayEstimate != null ? (
                          <span
                            className={`font-sans font-semibold ${
                              h.todayEstimate >= 0 ? 'text-danger-light' : 'text-success-light'
                            }`}
                          >
                            {formatCurrency(h.todayEstimate, true)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t-2 border-dark-border flex justify-end">
              <div className="text-base">
                <span className="text-gray-200 font-medium mr-2">今日预估收益合计：</span>
                <span
                  className={`font-display font-bold text-xl ${
                    holdingsWithEstimate.reduce((s, h) => s + (h.todayEstimate ?? 0), 0) >= 0
                      ? 'text-danger-light'
                      : 'text-success-light'
                  }`}
                >
                  {formatCurrency(
                    holdingsWithEstimate.reduce((s, h) => s + (h.todayEstimate ?? 0), 0),
                    true
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* 添加自选基金 */}
      <Card hover className="animate-stagger-3">
        <h3 className="text-lg sm:text-xl font-display font-bold text-amber-400 mb-4 flex items-center gap-2">
          <span className="w-0.5 h-4 sm:h-5 bg-amber-400 rounded-full" />
          添加自选基金
        </h3>
        <div className="flex flex-wrap gap-3">
          <Input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="输入基金代码，如 000001"
            className="flex-1 min-w-[180px] text-base text-gray-100 placeholder:text-gray-400"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding} className="inline-flex items-center gap-2">
            <FiPlus className="w-4 h-4" />
            添加
          </Button>
        </div>
      </Card>

      {/* 实时估值列表 */}
      <Card hover className="animate-stagger-4">
        <h3 className="text-lg sm:text-xl font-display font-bold text-amber-400 mb-4 sm:mb-6 flex items-center gap-2">
          <span className="w-0.5 h-4 sm:h-5 bg-amber-400 rounded-full" />
          实时估值
        </h3>

        {loading && list.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-300">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-base">正在拉取估值…</p>
          </div>
        ) : fundCodes.length === 0 ? (
          <div className="py-12 text-center text-gray-300">
            <p className="text-base font-medium">暂无自选基金</p>
            <p className="text-sm mt-1">在上方输入基金代码添加后即可查看实时估值与今日预估涨幅</p>
          </div>
        ) : (
          <>
            {/* 移动端：卡片布局 */}
            <div className="md:hidden space-y-3">
              {list.map((item) => (
                <div
                  key={item.fundcode}
                  className="bg-dark-surface/80 border border-dark-border/60 rounded-xl p-4 hover:bg-dark-elevated transition-colors relative"
                >
                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={() => handleRemove(item.fundcode)}
                    className="absolute top-3 right-3 p-2 rounded-lg text-gray-400 hover:text-danger-light hover:bg-danger-base/10 transition-colors"
                    title="移除"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>

                  {/* 基金名称 */}
                  <div className="mb-3 pb-3 border-b border-dark-border/40 pr-10">
                    <div className="font-sans font-semibold text-white text-base">
                      {item.name || `基金 ${item.fundcode}`}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{item.fundcode}</div>
                  </div>

                  {/* 今日涨幅（醒目显示） */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-300">今日预估涨幅</span>
                    {item.error ? (
                      <span className="text-gray-400 text-sm">{item.error}</span>
                    ) : item.gszzl !== null ? (
                      <span
                        className={`font-sans font-bold text-lg px-3 py-1 rounded ${
                          item.gszzl >= 0
                            ? 'bg-danger-base/20 text-danger-light'
                            : 'bg-success-base/20 text-success-light'
                        }`}
                      >
                        {item.gszzl >= 0 ? '+' : ''}{item.gszzl}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>

                  {/* 详细信息网格 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">单位净值</span>
                      <span className="text-white font-medium">{item.dwjz}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">估值</span>
                      <span className="text-amber-400 font-semibold">{item.gsz}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-gray-400">估值时间</span>
                      <span className="text-gray-300">{item.gztime || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 桌面端：表格布局 */}
            <div className="hidden md:block overflow-x-auto -mx-2">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="text-left text-sm sm:text-base text-gray-200 border-b-2 border-dark-border">
                    <th className="pb-3 pr-2 font-sans font-semibold">基金</th>
                    <th className="pb-3 pr-2 font-sans font-semibold">单位净值</th>
                    <th className="pb-3 pr-2 font-sans font-semibold">估值</th>
                    <th className="pb-3 pr-2 font-sans font-semibold">今日预估涨幅</th>
                    <th className="pb-3 pr-2 font-sans font-semibold">估值时间</th>
                    <th className="pb-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => (
                    <tr
                      key={item.fundcode}
                      className="border-b border-dark-border/60 bg-dark-surface/80 hover:bg-dark-elevated transition-colors"
                    >
                      <td className="py-4 pr-2">
                        <div className="font-sans font-semibold text-white text-sm sm:text-base">{item.name || `基金 ${item.fundcode}`}</div>
                        <div className="text-sm text-gray-400 mt-0.5">{item.fundcode}</div>
                      </td>
                      <td className="py-4 pr-2 font-sans text-white font-semibold text-sm sm:text-base">{item.dwjz}</td>
                      <td className="py-4 pr-2 font-sans text-amber-400 font-semibold text-sm sm:text-base">{item.gsz}</td>
                      <td className="py-4 pr-2 text-sm sm:text-base">
                        {item.error ? (
                          <span className="text-gray-400">{item.error}</span>
                        ) : item.gszzl !== null ? (
                          <span
                            className={`font-sans font-semibold ${
                              item.gszzl >= 0 ? 'text-danger-light' : 'text-success-light'
                            }`}
                          >
                            {item.gszzl >= 0 ? '+' : ''}{item.gszzl}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-4 pr-2 text-sm text-gray-300 font-sans">{item.gztime || '—'}</td>
                      <td className="py-4">
                        <button
                          type="button"
                          onClick={() => handleRemove(item.fundcode)}
                          className="p-2 rounded-lg text-gray-400 hover:text-danger-light hover:bg-danger-base/10 transition-colors"
                          title="移除"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
