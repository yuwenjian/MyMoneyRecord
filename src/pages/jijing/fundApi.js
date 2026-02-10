/**
 * 基金实时估值 API
 * 数据来源：天天基金净值估算接口（仅供学习参考，以基金公司公布净值为准）
 */

const FUND_GZ_BASE = 'https://fundgz.1234567.com.cn/js'

/**
 * 请求单只基金实时估值（JSONP）
 * @param {string} fundCode 基金代码，如 '000001'
 * @returns {Promise<FundEstimation>}
 */
export function fetchFundEstimation(fundCode) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const url = `${FUND_GZ_BASE}/${fundCode}.js?rt=${Date.now()}`
    let settled = false

    const cleanup = () => {
      script.remove()
    }

    const finish = () => {
      if (settled) return
      settled = true
      window.jsonpgz = prevJsonpgz
      cleanup()
    }

    const prevJsonpgz = window.jsonpgz
    const handler = (data) => {
      finish()
      if (data && data.fundcode) {
        resolve(normalizeFundData(data))
      } else {
        reject(new Error('数据格式异常'))
      }
    }
    window.jsonpgz = (data) => {
      window.jsonpgz = prevJsonpgz
      handler(data)
    }

    script.src = url
    script.onerror = () => {
      if (!settled) {
        settled = true
        window.jsonpgz = prevJsonpgz
        cleanup()
        reject(new Error('网络请求失败，请检查基金代码或稍后重试'))
      }
    }

    script.onload = () => {
      setTimeout(() => {
        if (settled) return
        settled = true
        window.jsonpgz = prevJsonpgz
        cleanup()
        reject(new Error('基金代码无效或暂无估值数据'))
      }, 8000)
    }

    document.body.appendChild(script)
  })
}

/**
 * 批量请求多只基金估值（串行，避免 JSONP 回调冲突）
 * @param {string[]} fundCodes 基金代码列表
 * @returns {Promise<FundEstimation[]>}
 */
export async function fetchFundEstimations(fundCodes) {
  const results = []
  for (const code of fundCodes) {
    try {
      const data = await fetchFundEstimation(code)
      results.push(data)
    } catch (err) {
      results.push({
        fundcode: code,
        name: `基金 ${code}`,
        dwjz: '—',
        gsz: '—',
        gszzl: null,
        gztime: '',
        jzrq: '',
        error: err.message,
      })
    }
  }
  return results
}

/**
 * 标准化接口返回为前端使用的结构
 */
function normalizeFundData(raw) {
  const gszzl = raw.gszzl !== undefined && raw.gszzl !== '' ? parseFloat(raw.gszzl) : null
  return {
    fundcode: String(raw.fundcode || '').trim(),
    name: String(raw.name || '').trim(),
    jzrq: String(raw.jzrq || ''),
    dwjz: String(raw.dwjz || '—'),
    gsz: String(raw.gsz || '—'),
    gszzl,
    gztime: String(raw.gztime || ''),
    error: null,
  }
}
