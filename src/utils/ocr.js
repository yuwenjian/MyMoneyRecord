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

