import { createWorker } from 'tesseract.js'

/**
 * OCR 图片识别工具
 * 支持识别股票/基金账户截图中的关键数据
 * 优化版：支持同花顺App等主流券商App
 */

// 创建 OCR worker
let worker = null

const initWorker = async () => {
  if (!worker) {
    worker = await createWorker('chi_sim+eng', 1, {
      logger: m => console.log('OCR进度:', m)
    })
  }
  return worker
}

/**
 * 识别图片中的文本
 * @param {File|string} image - 图片文件或图片URL
 * @returns {Promise<string>} 识别出的文本
 */
export const recognizeText = async (image) => {
  try {
    const ocr = await initWorker()
    const { data: { text } } = await ocr.recognize(image)
    return text
  } catch (error) {
    console.error('OCR识别失败:', error)
    throw new Error('图片识别失败，请重试')
  }
}

/**
 * 从文本中提取数字（支持千分位、小数点）
 * 严格过滤：排除股票代码、基金代码等干扰
 * @param {string} text - 文本内容
 * @returns {number|null} 提取的数字
 */
const extractNumber = (text) => {
  if (!text) return null
  
  // 移除所有空格、逗号、人民币符号等，但保留小数点和负号
  const cleaned = text.replace(/[,，\s¥￥元]/g, '').replace(/\+/g, '')
  
  // 检测是否是股票代码格式（排除6位纯数字，无小数点）
  const isStockCode = /^[0-9]{6}$/.test(cleaned.trim())
  if (isStockCode) {
    console.log(`  [过滤] "${text}" → 股票代码，跳过`)
    return null
  }
  
  // 检测是否是基金代码格式（排除5-6位纯数字 + 字母）
  const isFundCode = /^[0-9]{5,6}[A-Z]*$/.test(cleaned.trim())
  if (isFundCode) {
    console.log(`  [过滤] "${text}" → 基金代码，跳过`)
    return null
  }
  
  // 优先匹配带千分位的金额格式（如 168,850.80）
  const originalText = text.replace(/[¥￥元]/g, '').trim()
  const commaNumberMatch = originalText.match(/(\d{1,3}(?:,\d{3})+\.?\d*)/)
  if (commaNumberMatch) {
    const num = parseFloat(commaNumberMatch[1].replace(/,/g, ''))
    if (!isNaN(num) && num >= 100) {
      console.log(`  [提取] "${text}" → ${num} (千分位格式) ✓`)
      return num
    }
  }
  
  // 优先匹配大额数字格式（≥100 且有小数点）
  const largeDecimalMatch = cleaned.match(/(\d{3,}\.\d{1,2})/)
  if (largeDecimalMatch) {
    const num = parseFloat(largeDecimalMatch[1])
    if (!isNaN(num) && num >= 100) {
      console.log(`  [提取] "${text}" → ${num} (大额小数) ✓`)
      return num
    }
  }
  
  // 匹配所有数字（支持小数和负号）
  const matches = cleaned.match(/-?\d+\.?\d*/g)
  if (matches && matches.length > 0) {
    // 过滤掉疑似股票代码的数字
    const validNumbers = matches
      .map(m => parseFloat(m))
      .filter(n => !isNaN(n))
      .filter(n => {
        // 排除6位整数（疑似股票代码）
        if (n >= 100000 && n < 1000000 && Number.isInteger(n)) {
          console.log(`  [过滤] ${n} → 疑似股票代码`)
          return false
        }
        return true
      })
    
    if (validNumbers.length > 0) {
      // 优先选择最大的数字（通常是我们要的金额）
      const maxNum = Math.max(...validNumbers)
      if (maxNum >= 0.01) {  // 至少0.01元
        console.log(`  [提取] "${text}" → ${maxNum}`)
        return maxNum
      }
    }
  }
  
  console.log(`  [提取] "${text}" → null (无有效数字)`)
  return null
}

/**
 * 智能解析同花顺App股票数据
 * @param {string} text - OCR识别的文本
 * @param {string} investmentType - 投资类型 'stock' 或 'fund'
 * @returns {Object} 解析出的数据
 */
const parseTonghuashunData = (text, investmentType = 'stock') => {
  const lines = text.split('\n').filter(line => line.trim())
  const result = {
    totalAsset: null,
    totalMarketValue: null,
    shanghaiIndex: null
  }

  console.log('======== 开始解析同花顺数据 ========')
  console.log('投资类型:', investmentType === 'stock' ? '股票' : '基金')
  console.log('原始文本行数:', lines.length)
  console.log('完整文本:', text)

  // 根据投资类型选择不同的关键词模式
  const patterns = investmentType === 'stock' 
    ? getStockPatterns()
    : getFundPatterns()

  console.log('使用关键词模式:', investmentType === 'stock' ? '股票模式' : '基金模式')

  // ... 后续逻辑使用 patterns
  return parseWithPatterns(text, lines, patterns, result, investmentType)
}

/**
 * 股票类型的关键词模式
 */
const getStockPatterns = () => {
  return {
    // 上证指数 - 通常在顶部显示
    shanghaiIndex: /上证指数|沪指|上证|sh.*index|指数/i,
    // 总资产
    totalAsset: /总资产|账户总资产|资产总额/i,
    // 总市值 - 股票专用
    totalMarketValue: /总市值|持有市值|市值/i,
    // 需要排除的关键词
    excludeKeywords: /盈亏|盈利|亏损|收益|利润|参考盈亏|当日.*盈亏|累计盈亏|持有收益|日收益/i,
  }
}

/**
 * 基金类型的关键词模式
 * 基金类型只需要识别总资产，不需要识别持有收益等
 */
const getFundPatterns = () => {
  return {
    // 基金指数（通常不需要）
    shanghaiIndex: /上证指数|沪指|上证/i,
    // 总资产 - 适度放宽，支持OCR识别错误的情况
    // "基金资产(元)" 可能被识别成 "基金资产 (元)", "基金 资产", "基金资产(7L)" 等
    totalAsset: /基金.*资产|基金.*总额|资产.*基金/i,  // ← 放宽匹配
    // 基金类型不需要识别市值/收益，设置为null
    totalMarketValue: null,
    // 排除所有收益相关的关键词，以及股票相关
    excludeKeywords: /收益|盈亏|盈利|亏损|利润|日收益|持有收益|累计收益|参考盈亏|当日.*盈亏|股票.*资产|持有市值/i,
  }
}

/**
 * 使用指定的模式解析数据
 * @param {string} investmentType - 投资类型，用于判断是否使用候选机制
 */
const parseWithPatterns = (text, lines, patterns, result, investmentType = 'stock') => {

  // 首先尝试从整体文本中直接提取上证指数（通常在顶部）
  const indexMatch = text.match(/(\d{4}\.\d{2})\s*[\+\-]/)
  if (indexMatch && !result.shanghaiIndex) {
    const num = parseFloat(indexMatch[1])
    if (num > 2000 && num < 5000) { // 上证指数合理范围
      result.shanghaiIndex = num
      console.log('✓ 从顶部提取到上证指数:', num)
    }
  }

  // 收集所有可能的数字及其上下文
  const allNumbers = []
  lines.forEach((line, index) => {
    const numbers = line.match(/\d{1,3}(?:,\d{3})*\.?\d*/g)
    if (numbers) {
      numbers.forEach(numStr => {
        const num = extractNumber(numStr)
        if (num && num > 0) {
          // 额外检查：排除明显的股票代码行、盈亏行、股票资产行
          const lineUpper = line.toUpperCase()
          const isStockLine = lineUpper.includes('603803') || 
                             lineUpper.includes('603267') || 
                             lineUpper.includes('513100') ||
                             lineUpper.includes('603316') ||
                             /\d{6}\s*融/.test(line) ||  // 如 "603803 融"
                             line.includes('股票资产') ||  // ← 新增：排除股票资产行
                             line.includes('股票资产(元)')
          
          const isProfitLossLine = patterns.excludeKeywords.test(line)  // 盈亏相关行
          
          if (!isStockLine && !isProfitLossLine) {
            allNumbers.push({
              value: num,
              line: line.trim(),
              lineIndex: index,
              context: {
                prev: index > 0 ? lines[index - 1] : '',
                current: line,
                next: index < lines.length - 1 ? lines[index + 1] : ''
              }
            })
          } else if (isStockLine) {
            console.log(`  [过滤股票行] ${line.trim()}`)
          } else if (isProfitLossLine) {
            console.log(`  [过滤盈亏行] ${line.trim()}`)
          }
        }
      })
    }
  })

  console.log('提取到的有效数字:', allNumbers.map(n => `${n.value} (${n.line})`))


  // 逐行分析 - 精确匹配
  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    console.log(`行${index}: "${trimmedLine}"`)

    // 总资产识别 - 严格验证（排除盈亏相关、股票资产）
    if (patterns.totalAsset.test(trimmedLine) && 
        !trimmedLine.includes('市值') && 
        !(/股票.*资产/.test(trimmedLine)) &&  // ← 排除"股票资产"但允许"基金资产"
        !patterns.excludeKeywords.test(trimmedLine)) {
      console.log(`  → 🎯 发现总资产关键词行: "${trimmedLine}"`)
      
      // 先尝试当前行
      let num = extractNumber(trimmedLine)
      console.log(`  → 当前行提取: ${num}`)
      
      // 如果当前行没有或数字太小，看下一行
      if ((!num || num < 100) && lines[index + 1]) {
        const nextLine = lines[index + 1]
        console.log(`  → 检查下一行: "${nextLine}"`)
        // 下一行也要排除盈亏关键词
        if (!patterns.excludeKeywords.test(nextLine)) {
          num = extractNumber(nextLine)
          console.log(`  → 下一行提取: ${num}`)
        } else {
          console.log(`  → 下一行包含盈亏关键词，跳过`)
        }
      }
      
      // 验证：总资产必须 > 1000（至少1千元）
      if (num && num >= 1000) {
        // 进一步验证：如果已经有总资产，选择较大的那个
        if (!result.totalAsset || num > result.totalAsset) {
          result.totalAsset = num
          console.log(`  ✅ 成功识别总资产: ${num}`)
        }
      } else {
        console.log(`  ✗ 数字验证失败: ${num} (必须 >= 1000)`)
      }
    }

    // 总市值识别 - 优先级最高，只要找到"总市值"关键词就提取其下方数字
    // 如果是基金模式且totalMarketValue为null，跳过市值识别
    if (patterns.totalMarketValue && 
        patterns.totalMarketValue.test(trimmedLine) && 
        !trimmedLine.includes('总资产') && 
        !patterns.excludeKeywords.test(trimmedLine)) {
      console.log(`  → 🎯 发现市值关键词行: "${trimmedLine}"`)
      
      let num = extractNumber(trimmedLine)
      let numSource = '当前行'
      console.log(`  → 当前行提取: ${num}`)
      
      // 尝试下一行
      if ((!num || num < 100) && lines[index + 1]) {
        const nextLine = lines[index + 1]
        console.log(`  → 检查下一行: "${nextLine}"`)
        
        // 只排除明确包含"盈亏"等关键词的行，数字本身可以提取
        const hasExcludeKeyword = patterns.excludeKeywords.test(nextLine)
        console.log(`  → 下一行包含排除关键词: ${hasExcludeKeyword}`)
        
        if (!hasExcludeKeyword) {
          const nextNum = extractNumber(nextLine)
          if (nextNum) {
            num = nextNum
            numSource = '下一行'
            console.log(`  → ✓ 下一行提取到: ${num}`)
          }
        } else {
          console.log(`  → ✗ 下一行包含盈亏关键词，跳过`)
        }
      }
      
      // 尝试第2行
      if ((!num || num < 100) && lines[index + 2]) {
        const nextLine2 = lines[index + 2]
        console.log(`  → 检查第2行: "${nextLine2}"`)
        
        if (!patterns.excludeKeywords.test(nextLine2)) {
          const nextNum2 = extractNumber(nextLine2)
          if (nextNum2) {
            num = nextNum2
            numSource = '第2行'
            console.log(`  → ✓ 第2行提取到: ${num}`)
          }
        }
      }
      
      // 只要找到合理的数字就接受
      if (num && num >= 100) {
        const rounded = Math.round(num * 100) / 100
        
        console.log(`  → 📊 候选总市值: ${rounded} (来源: ${numSource})`)
        
        // 简化验证：只检查基本合理性
        let isValid = true
        let rejectReason = ''
        
        // 唯一的硬性要求：市值不能大于总资产的110%
        if (result.totalAsset && rounded > result.totalAsset * 1.1) {
          isValid = false
          rejectReason = `超过总资产 (${rounded} > ${result.totalAsset * 1.1})`
        }
        
        // 如果是从"总市值"关键词的紧邻行提取，直接接受（不检查占比）
        if (numSource === '下一行' && !result.totalMarketValue) {
          if (isValid) {
            result.totalMarketValue = rounded
            console.log(`  ✓✓✓ 从"总市值"关键词下方成功识别: ${rounded}`)
          } else {
            console.log(`  ✗ 验证失败: ${rejectReason}`)
          }
        } else if (isValid && !result.totalMarketValue) {
          result.totalMarketValue = rounded
          console.log(`  ✓✓✓ 成功识别总市值: ${rounded}`)
        } else if (!isValid) {
          console.log(`  ✗ 市值验证失败: ${rejectReason}`)
        } else if (result.totalMarketValue) {
          console.log(`  ℹ️ 已有总市值 ${result.totalMarketValue}，跳过 ${rounded}`)
        }
      } else {
        console.log(`  ✗ 未找到有效数字 (需要 >= 100)`)
      }
    }

    // 上证指数识别
    if (patterns.shanghaiIndex.test(trimmedLine) && !result.shanghaiIndex) {
      let num = extractNumber(trimmedLine)
      if (!num && lines[index + 1]) {
        num = extractNumber(lines[index + 1])
      }
      // 验证是否在合理范围
      if (num && num > 2000 && num < 5000) {
        result.shanghaiIndex = num
        console.log(`  ✓ 识别到上证指数: ${num}`)
      }
    }
  })

  // 如果还没找到总资产，从所有大数字中选择最大的（排除股票代码）
  // 🆕 基金模式不使用候选机制，必须明确匹配到"基金资产"关键词
  if (!result.totalAsset && investmentType !== 'fund') {
    console.log(`  ℹ️ 股票模式：启动总资产候选机制`)
    
    const largeNumbers = allNumbers
      .filter(n => n.value >= 10000)  // 总资产至少1万
      .filter(n => {
        // 只排除明确的6位整数（股票代码：100000-999999）
        if (n.value >= 100000 && n.value < 1000000 && Number.isInteger(n.value)) {
          console.log(`  [候选过滤] ${n.value} 疑似6位股票代码`)
          return false
        }
        return true
      })
      .sort((a, b) => b.value - a.value)
    
    if (largeNumbers.length > 0) {
      result.totalAsset = largeNumbers[0].value
      console.log(`  ✓ 从大数字中选择总资产: ${result.totalAsset} (${largeNumbers[0].line})`)
    }
  } else if (!result.totalAsset && investmentType === 'fund') {
    console.log(`  ⚠️ 基金模式：未找到"基金资产"关键词，不使用候选机制`)
    console.log(`  ℹ️ 提示：请确保截图包含"基金资产(元)"或"基金总额"字样`)
  }

  // 如果还没找到总市值，在已有总资产的情况下，选择合适的数字（排除股票代码）
  // 基金模式不需要启动候选机制（patterns.totalMarketValue为null）
  if (!result.totalMarketValue && result.totalAsset && patterns.totalMarketValue) {
    console.log(`  ℹ️ 启动总市值候选机制，总资产: ${result.totalAsset}`)
    
    const candidates = allNumbers
      .filter(n => {
        // 放宽候选池范围：10%-95%（原来是20%-95%）
        const minValue = result.totalAsset * 0.10
        const maxValue = result.totalAsset * 0.95
        const inRange = n.value >= minValue && n.value <= maxValue
        
        console.log(`  [候选检查] ${n.value}: ${inRange ? '✓' : '✗'} (范围: ${minValue.toFixed(0)} - ${maxValue.toFixed(0)})`)
        
        return n.value >= 1000 && inRange
      })
      .filter(n => {
        // 只排除明确的6位整数（股票代码：100000-999999）
        // 5位数（如42047）和带小数的不过滤
        if (n.value >= 100000 && n.value < 1000000 && Number.isInteger(n.value)) {
          console.log(`  [候选过滤] ${n.value} 疑似6位股票代码`)
          return false
        }
        return true
      })
      .sort((a, b) => b.value - a.value) // 按从大到小排序
    
    console.log(`  → 候选池中有 ${candidates.length} 个数字`)
    
    if (candidates.length > 0) {
      const rounded = Math.round(candidates[0].value * 100) / 100
      result.totalMarketValue = rounded
      console.log(`  ✓ 从候选数字中选择总市值: ${rounded} (${candidates[0].line})`)
    } else {
      console.log(`  ✗✗✗ 没有找到符合条件的总市值候选`)
      console.log(`  ℹ️ 调试信息：`)
      console.log(`     - 总资产: ${result.totalAsset}`)
      console.log(`     - 候选范围: ${(result.totalAsset * 0.10).toFixed(0)} - ${(result.totalAsset * 0.95).toFixed(0)}`)
      console.log(`     - 所有数字: ${allNumbers.map(n => n.value).join(', ')}`)
    }
  }


  console.log('======== 最终解析结果 ========')
  console.log('总资产:', result.totalAsset || '❌ 未识别')
  console.log('总市值:', result.totalMarketValue || '（基金模式不识别）')
  console.log('上证指数:', result.shanghaiIndex || '未识别')
  
  // 如果是基金模式且未识别到总资产，提供调试建议
  if (!result.totalAsset && investmentType === 'fund') {
    console.log('\n⚠️ 基金模式未识别到总资产！')
    console.log('📋 调试建议：')
    console.log('1. 检查OCR原始文本中是否包含"基金资产"关键词')
    console.log('2. 查看上方日志中是否有"🎯 发现总资产关键词行"')
    console.log('3. 如果有关键词行但数字提取失败，检查数字格式')
    console.log('4. 截图建议：只截取基金资产部分，文字清晰')
  }
  
  console.log('============================')

  return result
}

/**
 * 智能解析股票账户数据（通用版本）
 * @param {string} text - OCR识别的文本
 * @returns {Object} 解析出的数据
 */
const parseStockData = (text) => {
  console.log('======== 调用股票解析模式 ========')
  
  // 使用统一的 parseTonghuashunData，传入 'stock' 类型
  const tonghuashunResult = parseTonghuashunData(text, 'stock')
  
  // 如果同花顺解析成功，直接返回
  if (tonghuashunResult.totalAsset || tonghuashunResult.shanghaiIndex) {
    return tonghuashunResult
  }

  // 否则使用通用解析
  console.log('同花顺解析失败，使用通用解析')
  const lines = text.split('\n').filter(line => line.trim())
  const result = {
    totalAsset: null,
    totalMarketValue: null,
    shanghaiIndex: null
  }

  const patterns = {
    totalAsset: /总资产|资产总额|账户总资产|总金额/i,
    totalMarketValue: /总市值|持仓市值|市值总额|证券市值/i,
    shanghaiIndex: /上证指数|上证|沪指|sh000001/i
  }

  lines.forEach((line, index) => {
    Object.keys(patterns).forEach(key => {
      if (patterns[key].test(line)) {
        const num = extractNumber(line)
        if (num) {
          result[key] = num
        } else if (lines[index + 1]) {
          result[key] = extractNumber(lines[index + 1])
        }
      }
    })
  })

  return result
}

/**
 * 智能解析基金账户数据
 * @param {string} text - OCR识别的文本
 * @returns {Object} 解析出的数据
 */
const parseFundData = (text) => {
  console.log('========  调用基金解析模式 ========')
  
  // 使用统一的 parseTonghuashunData，传入 'fund' 类型
  const result = parseTonghuashunData(text, 'fund')
  
  console.log('基金解析结果:', result)
  
  return result
}

/**
 * 主要的 OCR 识别和数据解析函数
 * @param {File} imageFile - 图片文件
 * @param {string} investmentType - 投资类型 'stock' 或 'fund'
 * @returns {Promise<Object>} 解析出的数据
 */
export const recognizeAccountData = async (imageFile, investmentType) => {
  try {
    // 1. 识别图片文本
    const text = await recognizeText(imageFile)
    console.log('识别的原始文本:', text)

    // 2. 根据投资类型解析数据
    let parsedData
    if (investmentType === 'stock') {
      parsedData = parseStockData(text)
    } else {
      parsedData = parseFundData(text)
    }

    console.log('解析的数据:', parsedData)

    // 3. 返回结果（即使没有识别到有效数据也返回成功，让多图片合并）
    return {
      success: true,
      data: parsedData,
      rawText: text,
      hasValidData: !!(parsedData.totalAsset || parsedData.totalMarketValue || parsedData.shanghaiIndex)
    }
  } catch (error) {
    console.error('识别失败:', error)
    return {
      success: false,
      error: error.message || '识别失败',
      rawText: '',
      hasValidData: false
    }
  }
}

/**
 * 解析持仓列表数据（从持仓明细截图）
 * 支持两种格式：
 * 1. 简单表格格式：名称 | 数量 | 成本价 | 当前价
 * 2. 同花顺App格式：股票名称 + 数据行
 * @param {string} text - OCR识别的文本
 * @param {string} investmentType - 投资类型 'stock' 或 'fund'
 * @returns {Array} 持仓列表
 */
const parseHoldingsList = (text, investmentType = 'stock') => {
  const lines = text.split('\n').filter(line => line.trim())
  const holdings = []
  
  console.log('======== 开始解析持仓列表 ========')
  console.log('投资类型:', investmentType === 'stock' ? '股票' : '基金')
  console.log('原始文本行数:', lines.length)
  console.log('完整文本:', text)
  
  if (investmentType === 'stock') {
    // 首先尝试识别简单表格格式：名称 | 数量 | 成本价 | 当前价
    // 这种格式通常每行包含：股票名称 + 3-4个数字（数量、成本价、当前价）
    
    let foundTableFormat = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 跳过表头行（包含"名称"、"数量"、"成本价"、"当前价"等关键词）
      if (/^名称|^数量|^成本价|^当前价|市值|盈亏|持仓|可用/i.test(line) && 
          !/[\u4e00-\u9fa5]{2,}/.test(line.replace(/名称|数量|成本价|当前价|市值|盈亏|持仓|可用/g, ''))) {
        console.log(`  ⏭️  跳过表头: ${line}`)
        continue
      }
      
      // 尝试匹配表格行格式：股票名称 + 数量 + 成本价 + 当前价
      // 模式1: 中文名称 + 数字（可能有逗号）+ 数字（可能有小数点）+ 数字（可能有小数点）
      // 例如：卫星ETF 1,300 2.19 2.10
      // 或者：鸿远电子 600 47.94 56.26
      
      // 提取股票名称（中文，可能包含ETF等，排除数字和特殊符号）
      // 名称在行首
      const nameMatch = line.match(/^([\u4e00-\u9fa5]{2,}(?:\s*ETF)?)/)
      
      if (!nameMatch) {
        continue
      }
      
      const stockName = nameMatch[1].trim()
      
      // 提取名称之后的所有数字（按照表格列顺序：数量、成本价、当前价）
      // 使用更精确的正则，匹配名称后的所有数字
      const afterName = line.substring(nameMatch[0].length).trim()
      
      // 提取所有数字（包括带逗号的，支持负数）
      const allNumbers = afterName.match(/-?[\d,]+\.?\d*/g) || []
      const parsedNumbers = allNumbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n))
      
      if (parsedNumbers.length >= 3) {
        console.log(`  📌 发现股票名称: ${stockName}, 数字: ${parsedNumbers.join(', ')}`)
        
        // 按照表格列顺序识别：数量、成本价、当前价
        // 数量：通常是较大的整数（>= 100），可能有千分位逗号
        // 成本价：可能是正数或负数，较小的数字（通常 < 1000），可能有小数点
        // 当前价：正数，较小的数字（通常 < 1000），可能有小数点
        
        // 策略：按照顺序，第一个较大的整数是数量，后面两个较小的数字是成本价和当前价
        let amount = null
        let cost = 0
        let currentPrice = 0
        
        // 找出数量（第一个较大的整数，>= 100）
        for (let i = 0; i < parsedNumbers.length; i++) {
          const num = parsedNumbers[i]
          if (Number.isInteger(num) && num >= 100) {
            amount = num
            // 数量后面的两个数字就是成本价和当前价
            if (i + 1 < parsedNumbers.length) {
              cost = parsedNumbers[i + 1]
            }
            if (i + 2 < parsedNumbers.length) {
              currentPrice = parsedNumbers[i + 2]
            } else if (i + 1 < parsedNumbers.length) {
              // 如果只有两个数字，第二个既是成本价也是当前价
              currentPrice = parsedNumbers[i + 1]
            }
            break
          }
        }
        
        // 如果没找到数量，尝试其他策略
        if (!amount) {
          // 如果所有数字都是小数或负数，可能是格式不同
          // 尝试：第一个数字是数量（即使不是整数），后面是价格
          if (parsedNumbers.length >= 3) {
            // 找出最大的数字作为数量
            const maxNum = Math.max(...parsedNumbers.filter(n => n > 0))
            const maxIndex = parsedNumbers.indexOf(maxNum)
            
            if (maxNum >= 100) {
              amount = Math.round(maxNum) // 数量取整
              
              // 数量前后的数字是价格
              const priceNumbers = parsedNumbers.filter((n, idx) => idx !== maxIndex && Math.abs(n) < 1000)
              
              if (priceNumbers.length >= 2) {
                // 按顺序：成本价在前，当前价在后
                cost = priceNumbers[0]
                currentPrice = priceNumbers[1]
              } else if (priceNumbers.length === 1) {
                cost = priceNumbers[0]
                currentPrice = priceNumbers[0] < 0 ? 0 : priceNumbers[0]
              }
            }
          }
        }
        
        // 如果数量存在且至少有一个价格，则认为是有效持仓
        if (amount && (cost !== 0 || currentPrice !== 0)) {
          holdings.push({
            name: stockName,
            amount: amount,
            cost: cost,
            currentPrice: currentPrice > 0 ? currentPrice : (cost > 0 && cost < 1000 ? cost : 0),
            notes: ''
          })
          foundTableFormat = true
          console.log(`  ✅ 识别持仓(表格格式): ${stockName} - 数量:${amount} 成本:${cost} 当前:${currentPrice}`)
          continue
        }
      } else if (parsedNumbers.length === 2) {
        // 只有两个数字的情况：可能是数量 + 成本价，或者成本价 + 当前价
        console.log(`  ⚠️  只有2个数字: ${stockName}, 数字: ${parsedNumbers.join(', ')}`)
        // 暂时跳过，等待更多数据
      }
      
      // 如果表格格式识别失败，尝试更宽松的模式
      // 模式2: 尝试识别包含中文名称和多个数字的行
      const chineseNameMatch = line.match(/([\u4e00-\u9fa5]{2,}(?:\s*ETF)?)/)
      if (chineseNameMatch && parsedNumbers.length >= 3) {
        const stockName = chineseNameMatch[1].trim()
        
        // 尝试从数字中推断
        // 数量通常是最大的整数
        const maxInteger = Math.max(...parsedNumbers.filter(n => Number.isInteger(n) && n >= 100), 0)
        const amount = maxInteger > 0 ? maxInteger : parsedNumbers[0]
        
        // 价格是较小的数字
        const prices = parsedNumbers.filter(n => n > 0 && n < 1000 && n !== amount)
        
        if (prices.length >= 2) {
          holdings.push({
            name: stockName,
            amount: amount,
            cost: prices[0],
            currentPrice: prices[1],
            notes: ''
          })
          foundTableFormat = true
          console.log(`  ✅ 识别持仓(宽松模式): ${stockName} - 数量:${amount} 成本:${prices[0]} 当前:${prices[1]}`)
        }
      }
    }
    
    // 如果表格格式识别成功，直接返回
    if (foundTableFormat && holdings.length > 0) {
      console.log(`识别到 ${holdings.length} 个持仓（表格格式）`)
      console.log('============================')
      return holdings
    }
    
    // 同花顺App格式：两行格式
    // 第一行：股票名称
    // 第二行：市值 盈亏 持仓/可用 成本/现价
    // 根据标注：
    // - 数量：从 "持仓/可用" 列提取第一个数字（持仓数量）
    // - 成本价：从 "成本/现价" 列提取第一个数字（成本）
    // - 当前价：从 "成本/现价" 列提取第二个数字（现价）
    console.log('尝试同花顺App格式（两行格式）...')
    let currentStock = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 跳过表头和无关行
      if (/持仓股|市值|盈亏|持仓|可用|成本|现价|查看已清仓|买入|卖出|撤单|查询|同花顺|长按识别/i.test(line) && 
          !/[\u4e00-\u9fa5]{2,}/.test(line.replace(/持仓股|市值|盈亏|持仓|可用|成本|现价|查看已清仓|买入|卖出|撤单|查询|同花顺|长按识别/g, ''))) {
        continue
      }
      
      // 尝试识别股票名称（纯中文，2-6个字符，可能包含ETF，不包含数字）
      const stockNamePattern = /^([\u4e00-\u9fa5]{2,}(?:\s*ETF)?)$/
      const nameMatch = line.match(stockNamePattern)
      
      if (nameMatch) {
        // 找到股票名称，创建新的持仓对象
        currentStock = {
          name: nameMatch[1].trim().replace(/\s+ETF$/, ''),
          amount: 0,
          cost: 0,
          currentPrice: 0,
          notes: ''
        }
        console.log(`  📌 发现股票名称: ${currentStock.name}`)
        continue
      }
      
      // 如果已有股票名称，尝试从当前行提取数据
      if (currentStock) {
        // 提取所有数字（包括带逗号的，支持负数）
        const allNumbers = line.match(/-?[\d,]+\.?\d*/g) || []
        const parsedNumbers = allNumbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n))
        
        if (parsedNumbers.length >= 4) {
          console.log(`  📊 数据行: ${line}`)
          console.log(`  📊 提取的数字: ${parsedNumbers.join(', ')}`)
          
          // 根据同花顺App格式，数据行的结构：
          // 市值 盈亏金额 盈亏百分比 持仓数量 可用数量 成本价 现价
          // 或者：市值 盈亏金额 盈亏百分比 成本价 现价 持仓数量 可用数量
          
          // 策略：按照标注的位置识别
          // 1. 持仓数量：通常是整数，>= 100，<= 100000
          const amountCandidates = parsedNumbers.filter(n => 
            Number.isInteger(n) && n >= 100 && n <= 100000
          )
          
          if (amountCandidates.length > 0) {
            // 持仓数量通常是第一个或第二个较大的整数（第一个是持仓，第二个可能是可用）
            currentStock.amount = amountCandidates[0]
            
            // 2. 成本价和现价：较小的数字（< 1000），可能是负数
            // 价格通常在持仓数量之后，或者分散在数字中
            const priceCandidates = parsedNumbers.filter(n => {
              const absN = Math.abs(n)
              return absN > 0 && absN < 1000 && n !== currentStock.amount
            })
            
            if (priceCandidates.length >= 2) {
              // 通常成本价在前，现价在后
              // 如果第一个是负数，肯定是成本价
              if (priceCandidates[0] < 0) {
                currentStock.cost = priceCandidates[0]
                currentStock.currentPrice = priceCandidates[1]
              } else {
                // 两个都是正数，按顺序
                currentStock.cost = priceCandidates[0]
                currentStock.currentPrice = priceCandidates[1]
              }
            } else if (priceCandidates.length === 1) {
              currentStock.cost = priceCandidates[0]
              currentStock.currentPrice = priceCandidates[0] < 0 ? 0 : priceCandidates[0]
            }
            
            // 验证数据有效性
            if (currentStock.amount > 0 && (currentStock.cost !== 0 || currentStock.currentPrice !== 0)) {
              // 如果成本价为0但当前价不为0，尝试从其他位置找成本价
              if (currentStock.cost === 0 && currentStock.currentPrice > 0) {
                // 尝试从数字中找成本价（可能是负数或较小的正数）
                const costCandidate = parsedNumbers.find(n => 
                  n !== currentStock.amount && 
                  n !== currentStock.currentPrice && 
                  Math.abs(n) > 0 && 
                  Math.abs(n) < 1000
                )
                if (costCandidate) {
                  currentStock.cost = costCandidate
                }
              }
              
              holdings.push({ ...currentStock })
              console.log(`  ✅ 识别持仓: ${currentStock.name} - 数量:${currentStock.amount} 成本:${currentStock.cost} 当前:${currentStock.currentPrice}`)
              currentStock = null // 重置，准备识别下一个
            }
          } else {
            // 如果找不到明确的持仓数量，尝试从数字中推断
            const largeIntegers = parsedNumbers.filter(n => Number.isInteger(n) && n >= 100)
            if (largeIntegers.length > 0) {
              currentStock.amount = largeIntegers[0]
              
              // 价格是较小的数字
              const prices = parsedNumbers.filter(n => {
                const absN = Math.abs(n)
                return absN > 0 && absN < 1000 && n !== currentStock.amount
              })
              
              if (prices.length >= 2) {
                currentStock.cost = prices[0]
                currentStock.currentPrice = prices[1]
              } else if (prices.length === 1) {
                currentStock.cost = prices[0]
                currentStock.currentPrice = prices[0] < 0 ? 0 : prices[0]
              }
              
              if (currentStock.amount > 0 && (currentStock.cost !== 0 || currentStock.currentPrice !== 0)) {
                holdings.push({ ...currentStock })
                console.log(`  ✅ 识别持仓(推断): ${currentStock.name} - 数量:${currentStock.amount} 成本:${currentStock.cost} 当前:${currentStock.currentPrice}`)
                currentStock = null
              }
            }
          }
        }
      }
    }
  } else {
    // 基金持仓识别（类似股票逻辑）
    // ... 基金识别逻辑
  }
  
  console.log(`识别到 ${holdings.length} 个持仓`)
  console.log('============================')
  
  return holdings
}

/**
 * 识别持仓列表图片
 * @param {File} imageFile - 图片文件
 * @param {string} investmentType - 投资类型 'stock' 或 'fund'
 * @returns {Promise<Array>} 持仓列表
 */
export const recognizeHoldingsList = async (imageFile, investmentType = 'stock') => {
  try {
    // 1. 识别图片文本
    const text = await recognizeText(imageFile)
    console.log('识别的原始文本:', text)

    // 2. 解析持仓列表
    const holdings = parseHoldingsList(text, investmentType)

    return {
      success: true,
      holdings: holdings,
      rawText: text
    }
  } catch (error) {
    console.error('识别持仓列表失败:', error)
    return {
      success: false,
      error: error.message || '识别失败',
      holdings: [],
      rawText: ''
    }
  }
}

/**
 * 批量识别多张图片并智能合并结果
 * @param {File[]} imageFiles - 图片文件数组
 * @param {string} investmentType - 投资类型 'stock' 或 'fund'
 * @returns {Promise<Object>} 合并后的数据
 */
export const recognizeMultipleImages = async (imageFiles, investmentType) => {
  try {
    const results = await Promise.all(
      imageFiles.map(file => recognizeAccountData(file, investmentType))
    )

    // 合并所有识别结果
    const mergedData = {
      totalAsset: null,
      totalMarketValue: null,
      shanghaiIndex: null
    }

    results.forEach(result => {
      if (result.success && result.data) {
        // 优先使用非空值
        if (result.data.totalAsset && !mergedData.totalAsset) {
          mergedData.totalAsset = result.data.totalAsset
        }
        if (result.data.totalMarketValue && !mergedData.totalMarketValue) {
          mergedData.totalMarketValue = result.data.totalMarketValue
        }
        if (result.data.shanghaiIndex && !mergedData.shanghaiIndex) {
          mergedData.shanghaiIndex = result.data.shanghaiIndex
        }
      }
    })

    const hasValidData = !!(mergedData.totalAsset || mergedData.totalMarketValue || mergedData.shanghaiIndex)

    return {
      success: true,
      data: mergedData,
      hasValidData,
      individualResults: results
    }
  } catch (error) {
    console.error('批量识别失败:', error)
    return {
      success: false,
      error: error.message || '批量识别失败',
      hasValidData: false
    }
  }
}

/**
 * 清理 OCR worker（释放内存）
 */
export const terminateWorker = async () => {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}

/**
 * 从文本中智能提取所有可能的金额
 * 用于调试和手动验证
 */
export const extractAllNumbers = (text) => {
  const lines = text.split('\n')
  const results = []
  
  lines.forEach(line => {
    const numbers = line.match(/\d+[,，]?\d*\.?\d*/g)
    if (numbers) {
      numbers.forEach(num => {
        const value = extractNumber(num)
        if (value && value > 0) {
          results.push({
            line: line.trim(),
            value
          })
        }
      })
    }
  })
  
  return results
}

