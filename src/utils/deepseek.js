import { DEEPSEEK_API_KEY, DEEPSEEK_API_URL } from '../config/deepseek'

/**
 * 调用 DeepSeek API 获取 AI 分析
 * @param {string} prompt - 提示词
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} AI 返回的分析文本
 */
export async function callDeepSeekAPI(prompt, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API Key 未配置，请在 .env 文件中设置 VITE_DEEPSEEK_API_KEY')
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
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
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
 * 生成综合AI分析（整合大盘分析、持仓分析和盈亏对比）
 * @param {Object} data - 综合数据
 * @param {Array} holdings - 持仓列表
 * @returns {Promise<string>} AI 分析结果
 */
export async function generateComprehensiveAnalysis(data, holdings = []) {
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
  
  // 构建市场数据提示（如果用户提供了上证指数，则使用；否则提示AI尝试查询）
  let marketDataPrompt = ''
  if (shanghaiIndex) {
    marketDataPrompt = `**今日（${todayDateStr}）A股市场数据（基于用户记录）：**
- **上证指数**：${shanghaiIndex}点（用户记录的数据）

**注意：** 由于无法获取完整的实时市场数据，请基于以下策略进行分析：
1. 如果可能，尝试通过互联网搜索查询${todayDateStr}的完整市场数据（包括深证成指、创业板指、热门板块等）
2. 如果无法获取实时数据，请基于上证指数${shanghaiIndex}点进行合理分析
3. 在分析中明确说明数据来源和局限性`
  } else {
    marketDataPrompt = `**重要提示：** 请尝试通过互联网搜索查询今日（${todayDateStr}）A股市场的最新收盘数据。如果无法获取实时数据，请在分析中明确说明数据来源的局限性。`
  }
  
  const prompt = `请作为专业的投资理财分析师，对今日A股市场和我个人的投资情况进行全面分析。

${marketDataPrompt}

**我的投资数据：**
- 上证指数（我记录的）：${shanghaiIndex || '未提供'}
- 总资产：${totalAsset.toFixed(2)} 元
- 股票占比：${stockPercent}%，金额：${stockAsset.toFixed(2)} 元
- 基金占比：${fundPercent}%，金额：${fundAsset.toFixed(2)} 元
- 今日盈亏：${todayProfit >= 0 ? '+' : ''}${todayProfit.toFixed(2)} 元
- 今日收益率：${todayProfitPercent >= 0 ? '+' : ''}${todayProfitPercent.toFixed(2)}%
- 本月收益：${monthProfit >= 0 ? '+' : ''}${monthProfit.toFixed(2)} 元

${holdingsInfo.length > 0 ? `**我的持仓详情：**\n${holdingsInfo.join('\n\n')}\n` : '**我的持仓：**暂无持仓数据\n'}

请从以下三个维度进行深度分析，使用Markdown格式：

## 1. 今日大盘复盘

**请基于${todayDateStr}的市场数据进行分析：**

- **主要指数表现**：
  - 上证指数：${shanghaiIndex ? `收盘点位 ${shanghaiIndex}点（用户记录）` : '请尝试查询或说明无法获取'}
  - 深证成指：请尝试查询或说明数据来源
  - 创业板指：请尝试查询或说明数据来源
  - 如果无法获取完整数据，请基于已知数据（上证指数）进行合理分析
- **热门板块和行业分析**：如果可能，查询今日涨幅榜数据；如果无法获取，请基于市场一般规律进行分析
- **热门股票分析**：如果可能，查询涨幅榜数据；如果无法获取，请说明数据限制
- **市场情绪和资金流向分析**：如果可能，查询相关数据；如果无法获取，请说明数据限制

**重要：** 如果无法获取实时数据，请明确说明"由于无法获取${todayDateStr}的实时市场数据，以下分析基于已知数据和一般市场规律"，然后继续提供有价值的分析。

## 2. 持仓分析与投资建议

请结合今日大盘行情，对**每一只持仓**进行详细分析：
- **逐个分析每只股票/基金**：
  - 该持仓今日的表现（涨跌情况、与大盘对比）
  - 该持仓所属的行业/板块在今日市场的表现
  - 该持仓与今日热门板块/股票的关联性
  - 该持仓的盈亏情况分析（为什么盈利/亏损）
  - 该持仓的风险评估（高/中/低风险）
  - 针对该持仓的具体操作建议（持有/加仓/减仓/清仓）
- **整体持仓结构分析**：
  - 我的持仓组合与今日市场热点的匹配度
  - 持仓集中度分析（是否过于集中）
  - 行业分布是否合理
  - 风险分散是否充分
- **综合投资建议**：
  - 结合市场行情，给出具体的投资建议和操作指导
  - 风险提示和优化建议
  - 建议调整的持仓和理由

## 3. 盈亏对比分析

请对比分析：
- 我的今日收益率（${todayProfitPercent >= 0 ? '+' : ''}${todayProfitPercent.toFixed(2)}%）与大盘指数的表现对比
- 我的投资组合是否跑赢或跑输大盘，原因分析
- 总结今日盈亏的主要原因（是持仓结构问题、选股问题还是市场环境问题）
- 给出针对性的优化建议

请用专业但易懂的语言，确保分析深入且具有指导意义，总字数控制在1000字以内。`

  return await callDeepSeekAPI(prompt, {
    model: 'deepseek-chat',
    enableThinking: true, // 启用思考模式，提升分析准确性
    systemPrompt: `你是一位专业的投资理财分析师，擅长分析A股市场行情和投资组合表现。

**数据获取策略：**
1. 优先尝试通过互联网搜索查询最新的股市行情数据
2. 如果无法获取实时数据，请明确说明数据来源的局限性
3. 基于用户提供的已知数据（如用户记录的上证指数）进行分析
4. 如果数据不完整，可以基于已知数据和市场一般规律进行合理分析
5. 绝对不要编造或虚构市场数据

**分析要求：**
- 使用专业但易懂的语言进行分析
- 确保所有数据准确无误，明确标注数据来源
- 如果数据不完整，在分析开头明确说明数据限制
- 分析深入且具有指导意义
- 对每只持仓都要进行详细分析
- 即使数据不完整，也要提供有价值的投资建议`,
    maxTokens: 4000 // 增加token限制以支持更详细的分析
  })
}

