import { DEEPSEEK_API_KEY, DEEPSEEK_API_URL, getDeepSeekAPIKey } from '../config/deepseek'

/**
 * 调用 DeepSeek API 获取 AI 分析
 * @param {string} prompt - 提示词
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} AI 返回的分析文本
 */
export async function callDeepSeekAPI(prompt, options = {}) {
  // 每次调用时重新获取 API Key（支持动态更新）
  const apiKey = getDeepSeekAPIKey()
  if (!apiKey) {
    throw new Error('DeepSeek API Key 未配置，请在设置页面配置 API Key')
  }

  try {
    const requestBody = {
      model: options.model || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || '你是一位专业的投资理财分析师，擅长分析股市行情和投资组合表现。你可以通过互联网实时查询最新的股市行情数据。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || 4000,
      stream: false
    }
    
    // 如果启用思考模式，添加 thinking 参数
    if (options.enableThinking) {
      requestBody.thinking = { type: 'enabled' }
      // 思考模式下不支持 temperature，所以不设置
    } else {
      requestBody.temperature = options.temperature || 0.7
    }
    
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    // 思考模式下，返回 content 和 reasoning_content
    const message = data.choices[0]?.message
    if (message?.reasoning_content) {
      // 如果有思考内容，可以选择返回或记录
      console.log('AI 思考过程:', message.reasoning_content)
    }
    return message?.content || '无法获取 AI 分析结果'
  } catch (error) {
    console.error('DeepSeek API 调用失败:', error)
    throw error
  }
}

/**
 * 生成综合AI分析（基于本地数据，包含历史趋势和风险评估）
 * @param {Object} data - 综合数据
 * @param {Array} holdings - 持仓列表
 * @param {Object} historyStats - 历史统计数据 { stats7d, stats30d }
 * @returns {Promise<string>} AI 分析结果
 */
export async function generateComprehensiveAnalysis(data, holdings = [], historyStats = null) {
  const { shanghaiIndex, todayProfit, todayProfitPercent, stockAsset, fundAsset, totalAsset, monthProfit, stockPercent, fundPercent } = data
  
  // 格式化持仓信息
  const stockHoldings = holdings.filter(h => h.investmentType === 'stock')
  const fundHoldings = holdings.filter(h => h.investmentType === 'fund')
  
  const holdingsInfo = []
  if (stockHoldings.length > 0) {
    holdingsInfo.push(`**股票持仓详情（共${stockHoldings.length}只）：**\n${stockHoldings.map((h, index) => {
      const profit = (h.currentPrice - h.cost) * h.amount
      const profitPercent = h.cost > 0 ? ((h.currentPrice - h.cost) / h.cost * 100).toFixed(2) : 0
      const marketValue = h.currentPrice * h.amount
      const costValue = h.cost * h.amount
      return `${index + 1}. **${h.name}**\n   - 持仓数量：${h.amount}股\n   - 成本价：${h.cost}元/股\n   - 当前价：${h.currentPrice}元/股\n   - 持仓市值：${marketValue.toFixed(2)}元\n   - 持仓成本：${costValue.toFixed(2)}元\n   - 浮动盈亏：${profit >= 0 ? '+' : ''}${profit.toFixed(2)}元\n   - 盈亏比例：${profitPercent >= 0 ? '+' : ''}${profitPercent}%\n   - 备注：${h.notes || '无'}`
    }).join('\n\n')}`)
  }
  if (fundHoldings.length > 0) {
    holdingsInfo.push(`**基金持仓详情（共${fundHoldings.length}只）：**\n${fundHoldings.map((h, index) => {
      const profit = (h.currentPrice - h.cost) * h.amount
      const profitPercent = h.cost > 0 ? ((h.currentPrice - h.cost) / h.cost * 100).toFixed(2) : 0
      const marketValue = h.currentPrice * h.amount
      const costValue = h.cost * h.amount
      return `${index + 1}. **${h.name}**\n   - 持仓份额：${h.amount}份\n   - 成本价：${h.cost}元/份\n   - 当前净值：${h.currentPrice}元/份\n   - 持仓市值：${marketValue.toFixed(2)}元\n   - 持仓成本：${costValue.toFixed(2)}元\n   - 浮动盈亏：${profit >= 0 ? '+' : ''}${profit.toFixed(2)}元\n   - 盈亏比例：${profitPercent >= 0 ? '+' : ''}${profitPercent}%\n   - 备注：${h.notes || '无'}`
    }).join('\n\n')}`)
  }

  const today = new Date()
  const todayStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  const todayDateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  
  // 格式化历史统计数据
  let historyStatsInfo = ''
  if (historyStats) {
    const { stats7d, stats30d } = historyStats
    
    if (stats7d?.total) {
      const stats7 = stats7d.total
      historyStatsInfo += `\n**近7天表现：**
- 总收益：${stats7.totalProfit >= 0 ? '+' : ''}${stats7.totalProfit.toFixed(2)}元
- 盈利天数：${stats7.profitableDays}天 / ${stats7.totalDays}天（胜率：${stats7.winRate.toFixed(1)}%）
- 平均每日收益：${stats7.avgDailyProfit >= 0 ? '+' : ''}${stats7.avgDailyProfit.toFixed(2)}元
- 最大回撤：${stats7.maxDrawdown.toFixed(2)}元（${stats7.maxDrawdownPercent.toFixed(2)}%）
- 波动性：${stats7.volatility.toFixed(2)}元
- 收益率：${stats7.returnRate >= 0 ? '+' : ''}${stats7.returnRate.toFixed(2)}%`
    }
    
    if (stats30d?.total) {
      const stats30 = stats30d.total
      historyStatsInfo += `\n\n**近30天表现：**
- 总收益：${stats30.totalProfit >= 0 ? '+' : ''}${stats30.totalProfit.toFixed(2)}元
- 盈利天数：${stats30.profitableDays}天 / ${stats30.totalDays}天（胜率：${stats30.winRate.toFixed(1)}%）
- 平均每日收益：${stats30.avgDailyProfit >= 0 ? '+' : ''}${stats30.avgDailyProfit.toFixed(2)}元
- 最大回撤：${stats30.maxDrawdown.toFixed(2)}元（${stats30.maxDrawdownPercent.toFixed(2)}%）
- 波动性：${stats30.volatility.toFixed(2)}元
- 收益率：${stats30.returnRate >= 0 ? '+' : ''}${stats30.returnRate.toFixed(2)}%`
    }
    
    if (stats7d?.stock && stats7d?.fund) {
      historyStatsInfo += `\n\n**股票 vs 基金对比（近7天）：**
- 股票收益：${stats7d.stock.totalProfit >= 0 ? '+' : ''}${stats7d.stock.totalProfit.toFixed(2)}元（胜率：${stats7d.stock.winRate.toFixed(1)}%）
- 基金收益：${stats7d.fund.totalProfit >= 0 ? '+' : ''}${stats7d.fund.totalProfit.toFixed(2)}元（胜率：${stats7d.fund.winRate.toFixed(1)}%）`
    }
  }
  
  // 构建市场数据提示（仅基于用户记录）
  let marketDataPrompt = ''
  if (shanghaiIndex) {
    marketDataPrompt = `**今日（${todayDateStr}）市场参考：**
- **上证指数**：${shanghaiIndex}点（您记录的数据）

**说明：** 分析将基于您记录的数据和持仓情况，不依赖外部市场数据。`
  } else {
    marketDataPrompt = `**说明：** 分析将基于您的持仓和收益数据，不依赖外部市场数据。`
  }
  
  const prompt = `请作为一位经验丰富的投资理财顾问，基于我提供的本地数据，对我的投资情况进行全面、通俗易懂的分析。

${marketDataPrompt}

**我的当前投资数据：**
- 总资产：${totalAsset.toFixed(2)} 元
- 股票占比：${stockPercent}%，金额：${stockAsset.toFixed(2)} 元
- 基金占比：${fundPercent}%，金额：${fundAsset.toFixed(2)} 元
- 今日盈亏：${todayProfit >= 0 ? '+' : ''}${todayProfit.toFixed(2)} 元
- 今日收益率：${todayProfitPercent >= 0 ? '+' : ''}${todayProfitPercent.toFixed(2)}%
- 本月收益：${monthProfit >= 0 ? '+' : ''}${monthProfit.toFixed(2)} 元
${shanghaiIndex ? `- 上证指数（我记录的）：${shanghaiIndex}点` : ''}

${historyStatsInfo}

${holdingsInfo.length > 0 ? `**我的持仓详情：**\n${holdingsInfo.join('\n\n')}\n` : '**我的持仓：**暂无持仓数据\n'}

请从以下五个维度进行深入分析，使用Markdown格式，语言要通俗易懂，避免过于专业的术语：

## 1. 今日表现总结

用简单明了的话总结：
- 今天赚了还是亏了？赚/亏了多少？
- 和昨天相比，资产是增加了还是减少了？
- 股票和基金哪个表现更好？
${shanghaiIndex ? `- 如果上证指数是${shanghaiIndex}点，我的收益和指数相比如何？` : ''}

## 2. 持仓详细分析

**对每一只持仓进行分析：**
${holdingsInfo.length > 0 ? `请逐个分析每只股票/基金，用通俗的语言说明：
- 这只持仓现在赚了还是亏了？赚/亏了多少？
- 为什么这只持仓会盈利/亏损？（比如：成本价和当前价的差距）
- 这只持仓的风险高还是低？（根据盈亏比例和持仓占比判断）
- **具体操作建议**：明确说明是"继续持有"、"考虑加仓"、"建议减仓"还是"考虑清仓"，并给出理由

**整体持仓结构：**
- 我的持仓是否过于集中在某几只股票/基金？（如果单只持仓占比超过30%，需要提醒风险）
- 股票和基金的配置比例是否合理？
- 持仓数量是否合适？（太少可能风险集中，太多可能难以管理）` : `目前暂无持仓数据，建议：
- 可以考虑开始建立投资组合
- 建议股票和基金合理配置，分散风险`}

## 3. 历史趋势分析

${historyStatsInfo ? `基于近7天和30天的数据，分析：
- 我的收益趋势是向上还是向下？
- 盈利天数占比如何？是经常赚钱还是经常亏钱？
- 收益是否稳定？波动大不大？
- 和之前相比，现在的表现是变好了还是变差了？

**风险评估：**
- 最大回撤是多少？这意味着什么？（用通俗的话解释：比如"最多的时候亏了XX元"）
- 波动性如何？收益是否稳定？
- 整体风险等级：低风险/中风险/高风险，并说明原因` : `历史数据不足，无法进行趋势分析。建议持续记录数据，以便后续分析。`}

## 4. 投资建议与优化

**具体操作建议：**
${holdingsInfo.length > 0 ? `- 列出需要调整的持仓，明确说明：
  - 哪些持仓建议减仓或清仓？（比如：亏损超过20%且风险高的）
  - 哪些持仓可以继续持有或加仓？（比如：盈利稳定且风险可控的）
  - 如何优化持仓结构？（比如：增加基金配置降低风险，或调整单只持仓占比）` : `- 建议开始建立投资组合，合理配置股票和基金`}

**风险提示：**
- 当前投资组合存在哪些风险？
- 需要注意哪些问题？
- 如何降低风险？

## 5. 总结与展望

用一段话总结：
- 当前投资状况的总体评价
- 主要优势和需要改进的地方
- 下一步的投资建议

**重要要求：**
1. 语言要通俗易懂，避免专业术语，如果必须用术语要简单解释
2. 必须给出具体的操作建议，比如"建议减仓XX股票20%"、"可以考虑加仓XX基金"
3. 风险评估要明确，说明为什么是低/中/高风险
4. 总字数控制在1200字以内，但要确保分析深入且有指导意义
5. 用第一人称"您"来称呼，让分析更亲切`

  return await callDeepSeekAPI(prompt, {
    model: 'deepseek-chat',
    enableThinking: false, // 基于本地数据，不需要思考模式
    systemPrompt: `你是一位经验丰富的投资理财顾问，擅长基于用户的投资数据进行分析和指导。

**分析原则：**
1. 完全基于用户提供的本地数据进行分析，不要尝试获取外部市场数据
2. 如果用户记录了上证指数，可以作为参考，但不要编造其他市场数据
3. 语言要通俗易懂，避免专业术语，如果必须用术语要简单解释
4. 必须给出具体的操作建议，比如"建议减仓XX股票"、"可以考虑加仓XX基金"
5. 风险评估要明确，说明为什么是低/中/高风险
6. 对每只持仓都要进行详细分析，给出具体建议

**分析风格：**
- 用第一人称"您"来称呼，让分析更亲切
- 用简单明了的话解释复杂的概念
- 用具体数字和例子说明问题
- 给出可操作的建议，不要只说空话`,
    maxTokens: 4000
  })
}

