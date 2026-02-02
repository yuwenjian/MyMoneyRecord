/**
 * OCR 图片识别工具
 * 使用 Tesseract.js（开源OCR库）进行文字识别
 * 支持中文和英文识别，完全免费，无需API密钥
 */

import { createWorker } from 'tesseract.js'

// Tesseract Worker 实例缓存
let worker = null
let workerInitialized = false

/**
 * 初始化 Tesseract Worker
 * @returns {Promise<Object>} Tesseract Worker 实例
 */
const initWorker = async () => {
  if (worker && workerInitialized) {
    return worker
  }

  try {
    console.log('初始化 Tesseract.js Worker...')
    worker = await createWorker('chi_sim+eng', 1, {
      logger: (m) => {
        // 可选：显示进度信息
        if (m.status === 'recognizing text') {
          console.log(`识别进度: ${Math.round(m.progress * 100)}%`)
        }
      }
    })
    workerInitialized = true
    console.log('✅ Tesseract.js Worker 初始化成功')
    return worker
  } catch (error) {
    console.error('初始化 Tesseract Worker 失败:', error)
    throw new Error('OCR引擎初始化失败，请刷新页面重试')
  }
}

/**
 * 将图片转换为可识别的格式
 * @param {File|string} image - 图片文件或URL
 * @returns {Promise<File|ImageData>} 图片对象
 */
const prepareImage = async (image) => {
  if (image instanceof File) {
    return image
  } else if (typeof image === 'string') {
    // 如果是URL，需要先获取图片
    const response = await fetch(image)
    const blob = await response.blob()
    return new File([blob], 'image.jpg', { type: blob.type })
  } else {
    throw new Error('不支持的图片格式，请提供图片文件或URL')
  }
}

/**
 * 识别图片中的文本（使用 Tesseract.js）
 * @param {File|string} image - 图片文件或URL
 * @returns {Promise<string>} 识别出的文本
 */
export const recognizeText = async (image) => {
  try {
    console.log('开始 Tesseract.js OCR 识别...')
    
    // 初始化 Worker
    const ocrWorker = await initWorker()
    
    // 准备图片
    const imageFile = await prepareImage(image)
    
    // 执行OCR识别
    const startTime = Date.now()
    console.log('正在识别图片文本...')
    
    const { data: { text } } = await ocrWorker.recognize(imageFile)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    // 清理文本（移除多余的空行）
    const cleanedText = text.trim().replace(/\n{3,}/g, '\n\n')
    
    console.log('✅ Tesseract.js OCR 识别完成')
    console.log(`识别文本长度: ${cleanedText.length} 字符`)
    console.log(`识别文本行数: ${cleanedText.split('\n').length}`)
    console.log(`识别耗时: ${duration} 秒`)
    console.log('识别文本预览（前500字符）:', cleanedText.substring(0, 500))
    
    return cleanedText
  } catch (error) {
    console.error('OCR识别失败:', error)
    throw new Error(`图片识别失败: ${error.message || '未知错误'}`)
  }
}

/**
 * 从文本中提取数字（增强版：支持千分位，优先提取大数字）
 * @param {string} text - 文本
 * @param {boolean} preferLarge - 是否优先返回大数字（默认true）
 * @returns {number|null} 提取的数字
 */
const extractNumber = (text, preferLarge = true) => {
  if (!text) return null
  
  // 优先匹配带千分位的数字（如 167,577.42 或 107,954.00）
  const commaNumberMatch = text.match(/(\d{1,3}(?:,\d{3})+\.?\d*)/)
  if (commaNumberMatch) {
    const num = parseFloat(commaNumberMatch[1].replace(/,/g, ''))
    if (!isNaN(num) && num > 0) {
      return num
    }
  }
  
  // 匹配带小数点的数字（如 107954.00, 4112.60）
  const decimalMatch = text.match(/(\d+\.\d{1,2})/)
  if (decimalMatch) {
    const num = parseFloat(decimalMatch[1])
    if (!isNaN(num) && num > 0) {
      return num
    }
  }
  
  // 移除空格、逗号、人民币符号等，保留小数点和负号
  const cleaned = text.replace(/[,，\s¥￥元]/g, '').replace(/\+/g, '')
  
  // 匹配数字（支持小数和负号）
  const matches = cleaned.match(/-?\d+\.?\d*/g)
  if (!matches || matches.length === 0) return null
  
  // 提取所有数字
  const numbers = matches
    .map(m => parseFloat(m))
    .filter(n => !isNaN(n) && n > 0)
  
  if (numbers.length === 0) return null
  
  // 优先返回带小数点的数字，如果没有则根据preferLarge返回最大或最小
  const decimalNumbers = numbers.filter(n => n % 1 !== 0)
  if (decimalNumbers.length > 0) {
    return preferLarge ? Math.max(...decimalNumbers) : Math.min(...decimalNumbers)
  }
  
  // 返回最大或最小的数字
  return preferLarge ? Math.max(...numbers) : Math.min(...numbers)
}

/**
 * 提取带千分位的完整数字字符串（用于更精确的匹配）
 * @param {string} text - 文本
 * @returns {string|null} 带千分位的数字字符串
 */
const extractNumberWithFormat = (text) => {
  if (!text) return null
  
  // 匹配带千分位的数字（如 167,577.42）
  const commaNumberMatch = text.match(/(\d{1,3}(?:,\d{3})+\.?\d*)/)
  if (commaNumberMatch) {
    return commaNumberMatch[1]
  }
  
  // 匹配带小数点的数字（如 107954.00, 4112.60）
  const decimalMatch = text.match(/(\d+\.\d{1,2})/)
  if (decimalMatch) {
    return decimalMatch[1]
  }
  
  return null
}

/**
 * 检查行是否包含排除关键词
 */
const isExcludeLine = (line) => {
  const excludePatterns = [
    /总盈亏|总.*盈亏/i,
    /盈亏|盈利|亏损/i,
    /收益|利润/i,
    /参考.*盈亏/i,
    /当日.*盈亏/i,
    /累计.*盈亏/i,
  ]
  
  return excludePatterns.some(pattern => pattern.test(line))
}

/**
 * 检查数字是否可能是股票代码
 * @param {number} num - 数字
 * @param {string} originalText - 原始文本（可选，用于检查是否有小数点）
 */
const isStockCode = (num, originalText = '') => {
  // 🆕 关键修复：如果原始文本包含小数点或逗号，即使提取后是整数，也不应该是股票代码
  // 例如："107,954.00" 提取后是 107954，但原始文本有小数点和逗号，所以不是股票代码
  if (originalText && (/\./.test(originalText) || /,/.test(originalText))) {
    return false
  }
  
  // 6位整数（100000-999999）且没有小数点，可能是股票代码
  // 但是，如果数字看起来像金额（在合理范围内），不应该被当作股票代码
  if (num >= 100000 && num < 1000000 && Number.isInteger(num)) {
    // 🆕 如果数字在合理范围内（可能是金额），不当作股票代码
    // 总市值通常在 10000-1000000 之间，不应该被过滤
    return false  // 暂时不过滤，因为可能是总市值
  }
  
  return false
}

/**
 * 检查行是否包含总资产相关关键词（支持OCR识别错误）
 */
const isTotalAssetLine = (line) => {
  // 支持多种可能的OCR识别结果
  const patterns = [
    /总资产/i,
    /资.*帐户/i,  // "资多帐户"、"资金帐户"等
    /帐户.*总/i,
    /资产.*总/i,
    /总.*资产/i,
    /资金.*总/i,  // "资金总额"
    /总.*资金/i,  // "总资金"
    /账户.*总/i,  // "账户总额"
    /总.*账户/i,  // "总账户"
    /资产/i,      // 仅包含"资产"（更宽松）
    /资金/i,      // 仅包含"资金"
  ]
  return patterns.some(p => p.test(line)) && !line.includes('市值') && !line.includes('盈亏')
}

/**
 * 检查行是否包含总市值相关关键词（支持OCR识别错误）
 */
const isTotalMarketValueLine = (line) => {
  const patterns = [
    /总市值/i,
    /持有市值/i,
    /市值.*总/i,
    /总.*市值/i,
    /市值/i,      // 仅包含"市值"（更宽松）
    /持有.*值/i,  // "持有值"
  ]
  return patterns.some(p => p.test(line)) && !line.includes('总资产') && !line.includes('盈亏')
}

/**
 * 智能推断：从大数字中推断总资产和总市值
 */
const inferFromLargeNumbers = (lines, profitLossNum) => {
  const largeNumbers = []
  
  // 收集所有大数字（>= 1000）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const num = extractNumber(line)
    
    if (num && num >= 1000 && !isStockCode(num, line)) {
      // 排除总盈亏数字
      if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
        // 🆕 放宽过滤条件：只排除明显的股票代码行（6位数字开头）
        // 允许包含"融"的行，因为可能是金额
        if (!/^\d{6}/.test(line) && !/^\d{6}\s/.test(line)) {
          largeNumbers.push({
            value: num,
            lineIndex: i,
            line: line
          })
        }
      }
    }
  }
  
  // 按数值大小排序
  largeNumbers.sort((a, b) => b.value - a.value)
  
  console.log('找到的大数字:', largeNumbers.map(n => `${n.value} (行[${n.lineIndex}]: "${n.line}")`))
  
  return largeNumbers
}

/**
 * 检查是否是干扰数字（账户号、百分比、股票代码等）
 * @param {number} num - 数字
 * @param {string} line - 原始文本行
 * @returns {boolean} 是否是干扰数字
 */
const isNoiseNumber = (num, line) => {
  // 排除账户号（通常是4位数字，且前后有*号或特殊字符，且不包含小数点）
  if (num >= 1000 && num < 10000 && /[*\*]/.test(line) && !/\./.test(line)) {
    return true
  }
  
  // 排除百分比中的数字（如 1.530% 中的 1530，但排除时要注意不要误判上证指数）
  // 如果数字在3000-5000之间且带小数点，很可能是上证指数，不是百分比
  if (num < 100 && /%/.test(line)) {
    return true
  }
  
  // 排除百分比中的大数字（如 1.530% 被识别为 1530）
  if (num >= 1000 && num < 2000 && /%/.test(line) && !/\./.test(line)) {
    return true
  }
  
  // 排除股票代码（6位数字）
  if (num >= 100000 && num < 1000000 && /^\d{6}/.test(line)) {
    return true
  }
  
  // 排除年份（如 2024），但要注意不要误判上证指数
  // 如果数字在4000-5000之间，更可能是上证指数而不是年份
  if (num >= 2000 && num < 2100 && /年/.test(line)) {
    return true
  }
  
  // 排除明显的小数字（如价格、百分比等）
  if (num < 100 && !/指数|沪指|上证/.test(line)) {
    // 如果不在指数关键词附近，且小于100，可能是干扰
    return false  // 暂时不过滤，让其他逻辑处理
  }
  
  return false
}

/**
 * 股票数据解析（全新算法）
 * 基于图片布局特征：总资产和总市值通常是大数字且带千分位，位置相邻
 */
const parseStockData = (text) => {
  const lines = text.split('\n').filter(line => line.trim())
  const result = {
    totalAsset: null,
    totalMarketValue: null,
    shanghaiIndex: null,
  }

  console.log('======== 开始解析股票数据（全新算法）========')
  console.log('文本行数:', lines.length)
  console.log('完整文本:', text)

  // 保存完整文本用于后续搜索
  const fullText = lines.join('\n')

  // 收集所有候选数字（带位置和格式信息）
  const candidates = []
  
  // 先找到"总盈亏"的数字，用于后续排除
  let profitLossNum = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/总盈亏|总.*盈亏/i.test(line)) {
      const num = extractNumber(line)
      if (num) {
        profitLossNum = num
        console.log(`找到"总盈亏"行[${i}]: "${line}" → ${num}`)
        break
      }
    }
  }

  // 第一步：识别总资产（优先识别带千分位的大数字）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // 检查是否包含"总资产"相关关键词
    if (/总资产|资金.*帐户|资.*帐户/i.test(line) && !/市值|盈亏/.test(line)) {
      console.log(`  → 发现"总资产"关键词行[${i}]: "${line}"`)
      
      // 在当前行、下一行、下两行查找大数字（>= 50000，通常总资产是最大的）
      for (let offset = 0; offset <= 2; offset++) {
        if (i + offset < lines.length) {
          const candidateLine = lines[i + offset].trim()
          const num = extractNumber(candidateLine)
          const formattedNum = extractNumberWithFormat(candidateLine)
          
          // 优先识别带千分位的大数字（>= 50000）
          if (num && num >= 50000 && !isNoiseNumber(num, candidateLine)) {
            if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
              // 检查是否带千分位（更准确）
              const hasComma = formattedNum && formattedNum.includes(',')
              result.totalAsset = num
              console.log(`  ✅✅✅ 识别总资产: ${num} (行[${i + offset}], 带千分位: ${hasComma})`)
              break
            }
          }
        }
      }
      
      if (result.totalAsset) break
    }
  }
  
  // 如果总资产未识别，尝试从所有大数字中推断（最大的通常是总资产）
  if (!result.totalAsset) {
    console.log('总资产关键词匹配失败，尝试从大数字中推断...')
    const largeNumbers = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const num = extractNumber(line)
      const formattedNum = extractNumberWithFormat(line)
      
      // 收集大数字（>= 50000），优先带千分位的
      if (num && num >= 50000 && !isNoiseNumber(num, line)) {
        if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
          const hasComma = formattedNum && formattedNum.includes(',')
          largeNumbers.push({
            value: num,
            lineIndex: i,
            line: line,
            hasComma: hasComma,
            priority: hasComma ? 2 : 1  // 带千分位的优先级更高
          })
        }
      }
    }
    
    if (largeNumbers.length > 0) {
      // 按优先级和数值大小排序
      largeNumbers.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return b.value - a.value
      })
      
      result.totalAsset = largeNumbers[0].value
      console.log(`  ✅ 智能推断总资产: ${result.totalAsset} (行[${largeNumbers[0].lineIndex}], 带千分位: ${largeNumbers[0].hasComma})`)
    }
  }

  // 第二步：识别总市值（通常在总资产附近，且小于总资产）
  if (result.totalAsset) {
    // 先尝试在总资产关键词附近查找
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (/总市值|持有市值/i.test(line) && !/总资产|盈亏/.test(line)) {
        console.log(`  → 发现"总市值"关键词行[${i}]: "${line}"`)
        
        // 在当前行、下一行、下两行查找中等大小的数字（10000-200000）
        for (let offset = 0; offset <= 2; offset++) {
          if (i + offset < lines.length) {
            const candidateLine = lines[i + offset].trim()
            const num = extractNumber(candidateLine)
            const formattedNum = extractNumberWithFormat(candidateLine)
            
            // 总市值应该小于总资产，且在合理范围内
            if (num && num >= 10000 && num < result.totalAsset && !isNoiseNumber(num, candidateLine)) {
              if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
                const hasComma = formattedNum && formattedNum.includes(',')
                result.totalMarketValue = num
                console.log(`  ✅✅✅ 识别总市值: ${num} (行[${i + offset}], 带千分位: ${hasComma})`)
                break
              }
            }
          }
        }
        
        if (result.totalMarketValue) break
      }
    }
    
    // 如果总市值未识别，尝试在总资产附近查找
    if (!result.totalMarketValue) {
      console.log('总市值关键词匹配失败，尝试在总资产附近查找...')
      
      // 找到总资产所在的行
      let totalAssetLineIndex = -1
      for (let idx = 0; idx < lines.length; idx++) {
        const num = extractNumber(lines[idx].trim())
        if (num && Math.abs(num - result.totalAsset) < 0.01) {
          totalAssetLineIndex = idx
          break
        }
      }
      
      if (totalAssetLineIndex !== -1) {
        // 在总资产附近（前后3行）查找中等大小的数字
        for (let offset = -3; offset <= 3; offset++) {
          const idx = totalAssetLineIndex + offset
          if (idx >= 0 && idx < lines.length && idx !== totalAssetLineIndex) {
            const candidateLine = lines[idx].trim()
            const num = extractNumber(candidateLine)
            
            if (num && num >= 10000 && num < result.totalAsset && !isNoiseNumber(num, candidateLine)) {
              if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
                result.totalMarketValue = num
                console.log(`  ✅ 在总资产附近找到总市值: ${num} (行[${idx}])`)
                break
              }
            }
          }
        }
      }
    }
  }

  // 第三步：识别上证指数（最激进的策略：直接找所有符合条件的数字）
  console.log('======== 开始识别上证指数 ========')
  console.log('完整文本内容:', fullText)
  console.log('所有行:', lines.map((l, i) => `[${i}]: ${l}`).join('\n'))
  
  // 最激进的策略：直接搜索所有4000-5000之间的数字，不管其他条件
  const allNumbers = []
  
  // 方法1：正则匹配所有数字（包括带小数点的）
  const numberPatterns = [
    /(\d{4}\.\d{1,2})/g,  // 带小数点的4位数
    /(\d{4})/g             // 4位整数
  ]
  
  for (const pattern of numberPatterns) {
    const matches = [...fullText.matchAll(pattern)]
    for (const match of matches) {
      const num = parseFloat(match[1])
      if (num >= 4000 && num < 5000) {
        const matchIndex = match.index
        const lineNum = fullText.substring(0, matchIndex).split('\n').length - 1
        allNumbers.push({
          num,
          match: match[1],
          lineIndex: lineNum,
          hasDecimal: match[1].includes('.'),
          context: fullText.substring(Math.max(0, matchIndex - 50), Math.min(fullText.length, matchIndex + 50))
        })
      }
    }
  }
  
  console.log(`找到所有4000-5000之间的数字 (${allNumbers.length}个):`)
  allNumbers.forEach((n, i) => {
    console.log(`  [${i}] ${n.num} (${n.match}) - 行[${n.lineIndex}], 带小数点: ${n.hasDecimal}`)
    console.log(`      上下文: ${n.context}`)
  })
  
  // 如果找到了数字，选择最合适的
  if (allNumbers.length > 0) {
    // 优先选择带小数点的
    const withDecimal = allNumbers.filter(n => n.hasDecimal)
    if (withDecimal.length > 0) {
      // 如果有多个，选择最大的（更可能是上证指数）
      withDecimal.sort((a, b) => b.num - a.num)
      result.shanghaiIndex = withDecimal[0].num
      console.log(`  ✅✅✅ 识别上证指数: ${result.shanghaiIndex} (带小数点，从 ${withDecimal.length} 个候选中选择)`)
    } else {
      // 如果没有带小数点的，选择最大的整数
      allNumbers.sort((a, b) => b.num - a.num)
      result.shanghaiIndex = allNumbers[0].num
      console.log(`  ✅ 识别上证指数: ${result.shanghaiIndex} (整数，从 ${allNumbers.length} 个候选中选择)`)
    }
  } else {
    console.log('  ❌ 未找到4000-5000之间的数字')
    
    // 如果没找到，尝试更宽的范围：3000-5000
    console.log('尝试扩大范围到3000-5000...')
    const widerNumbers = []
    for (const pattern of numberPatterns) {
      const matches = [...fullText.matchAll(pattern)]
      for (const match of matches) {
        const num = parseFloat(match[1])
        if (num >= 3000 && num < 5000) {
          const matchIndex = match.index
          const lineNum = fullText.substring(0, matchIndex).split('\n').length - 1
          widerNumbers.push({
            num,
            match: match[1],
            lineIndex: lineNum,
            hasDecimal: match[1].includes('.'),
            context: fullText.substring(Math.max(0, matchIndex - 50), Math.min(fullText.length, matchIndex + 50))
          })
        }
      }
    }
    
    console.log(`找到3000-5000之间的数字 (${widerNumbers.length}个):`)
    widerNumbers.forEach((n, i) => {
      console.log(`  [${i}] ${n.num} (${n.match}) - 行[${n.lineIndex}], 带小数点: ${n.hasDecimal}`)
    })
    
    if (widerNumbers.length > 0) {
      // 优先选择4000+的
      const over4000 = widerNumbers.filter(n => n.num >= 4000)
      if (over4000.length > 0) {
        over4000.sort((a, b) => {
          if (a.hasDecimal !== b.hasDecimal) return b.hasDecimal - a.hasDecimal
          return b.num - a.num
        })
        result.shanghaiIndex = over4000[0].num
        console.log(`  ✅ 识别上证指数: ${result.shanghaiIndex} (从3000-5000范围中选择)`)
      } else {
        // 如果没有4000+的，选择最大的带小数点的
        const withDecimal = widerNumbers.filter(n => n.hasDecimal)
        if (withDecimal.length > 0) {
          withDecimal.sort((a, b) => b.num - a.num)
          result.shanghaiIndex = withDecimal[0].num
          console.log(`  ✅ 识别上证指数: ${result.shanghaiIndex} (带小数点，从3000-5000范围中选择)`)
        }
      }
    }
  }
  
  console.log('======== 上证指数识别完成 ========')

  console.log('======== 解析结果 ========')
  console.log('总资产:', result.totalAsset || '未识别')
  console.log('总市值:', result.totalMarketValue || '未识别')
  console.log('上证指数:', result.shanghaiIndex || '未识别')
  console.log('========================')

  return result
}

/**
 * 基金数据解析（保留原有方法）
 */
const parseFundData = (text) => {
  const lines = text.split('\n').filter(line => line.trim())
  const result = {
    totalAsset: null,
    totalMarketValue: null,
    shanghaiIndex: null,
  }

  console.log('======== 开始解析基金数据 ========')
  console.log('文本行数:', lines.length)
  console.log('完整文本:', text)

  // 基金模式：查找"基金资产"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (/基金.*资产|基金.*总额/i.test(line) && !isExcludeLine(line)) {
      console.log(`  → 发现"基金资产"关键词`)
      
      let num = extractNumber(line)
      if (num && num >= 1000) {
        result.totalAsset = num
        console.log(`  ✅ 从当前行提取总资产: ${num}`)
        break
      }
      
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (!isExcludeLine(nextLine)) {
          num = extractNumber(nextLine)
          if (num && num >= 1000) {
            result.totalAsset = num
            console.log(`  ✅ 从下一行提取总资产: ${num}`)
            break
          }
        }
      }
    }
  }

  console.log('======== 解析结果 ========')
  console.log('总资产:', result.totalAsset || '未识别')
  console.log('总市值:', '（基金模式不识别）')
  console.log('上证指数:', result.shanghaiIndex || '未识别')
  console.log('========================')

  return result
}

/**
 * 主要的 OCR 识别和数据解析函数
 */
export const recognizeAccountData = async (imageFile, investmentType) => {
  try {
    // 1. 识别图片文本
    const text = await recognizeText(imageFile)
    console.log('======== OCR识别结果 ========')
    console.log('识别的原始文本:', text)
    console.log('文本长度:', text.length)
    console.log('文本行数:', text.split('\n').length)

    // 检查是否识别到文本
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ OCR未识别到任何文本')
      return {
        success: false,
        error: 'OCR未识别到任何文本，请确保图片清晰且包含文字',
        data: { totalAsset: null, totalMarketValue: null, shanghaiIndex: null },
        rawText: text,
        hasValidData: false
      }
    }

    // 2. 根据投资类型解析数据
    let parsedData
    if (investmentType === 'stock') {
      parsedData = parseStockData(text)
    } else {
      parsedData = parseFundData(text)
    }

    console.log('======== 解析结果 ========')
    console.log('解析的数据:', parsedData)
    console.log('总资产:', parsedData.totalAsset)
    console.log('总市值:', parsedData.totalMarketValue)
    console.log('上证指数:', parsedData.shanghaiIndex)
    
    const hasValidData = !!(parsedData.totalAsset || parsedData.totalMarketValue || parsedData.shanghaiIndex)
    console.log('是否有有效数据:', hasValidData)
    
    if (!hasValidData) {
      console.warn('⚠️ 未识别到有效数据（总资产、总市值、上证指数）')
      console.log('提示：请检查图片是否包含以下关键词之一：')
      console.log('  - 总资产 / 资金账户')
      console.log('  - 总市值 / 持有市值')
      console.log('  - 上证指数 / 沪指')
    }

    // 3. 返回结果
    return {
      success: true,
      data: parsedData,
      rawText: text,
      hasValidData: hasValidData
    }
  } catch (error) {
    console.error('======== 识别失败 ========')
    console.error('错误信息:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      error: error.message || '识别失败',
      rawText: '',
      hasValidData: false
    }
  }
}

/**
 * 解析持仓列表数据（简化版）
 */
const parseHoldingsList = (text, investmentType = 'stock') => {
  const lines = text.split('\n').filter(line => line.trim())
  const holdings = []

  console.log('======== 开始解析持仓列表 ========')
  console.log('文本行数:', lines.length)

  // 简单的持仓解析逻辑
  // 这里可以根据实际需求扩展
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const num = extractNumber(line)
    
    if (num && num >= 1 && num < 1000000) {
      // 可能是持仓数据，这里简化处理
      // 实际应用中需要更复杂的解析逻辑
    }
  }

  console.log('解析的持仓数量:', holdings.length)
  return holdings
}

/**
 * 识别持仓列表图片
 */
export const recognizeHoldingsList = async (imageFile, investmentType = 'stock') => {
  try {
    const text = await recognizeText(imageFile)
    console.log('识别的原始文本:', text)
    
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
 */
export const recognizeMultipleImages = async (imageFiles, investmentType) => {
  try {
    const results = await Promise.all(
      imageFiles.map(file => recognizeAccountData(file, investmentType))
    )

    // 合并结果：取每个字段的第一个非空值
    // 🆕 对于上证指数，优先选择带小数点的值（更准确）
    const mergedData = {
      totalAsset: null,
      totalMarketValue: null,
      shanghaiIndex: null,
    }
    
    const shanghaiIndexCandidates = []  // 收集所有上证指数候选值

    for (const result of results) {
      if (result.success && result.data) {
        if (!mergedData.totalAsset && result.data.totalAsset) {
          mergedData.totalAsset = result.data.totalAsset
        }
        if (!mergedData.totalMarketValue && result.data.totalMarketValue) {
          mergedData.totalMarketValue = result.data.totalMarketValue
        }
        // 🆕 收集所有上证指数候选值
        if (result.data.shanghaiIndex) {
          // 检查原始文本中是否有小数点（更准确）
          const hasDecimal = result.rawText.includes(result.data.shanghaiIndex.toString() + '.') ||
                            result.rawText.match(new RegExp(result.data.shanghaiIndex.toString().replace('.', '\\.') + '\\.\\d+'))
          shanghaiIndexCandidates.push({
            value: result.data.shanghaiIndex,
            hasDecimal: hasDecimal || result.data.shanghaiIndex.toString().includes('.'),
            rawText: result.rawText
          })
        }

      }
    }
    
    // 🆕 从候选值中选择最佳的上证指数：优先选择带小数点的
    if (shanghaiIndexCandidates.length > 0) {
      shanghaiIndexCandidates.sort((a, b) => {
        if (a.hasDecimal !== b.hasDecimal) {
          return b.hasDecimal - a.hasDecimal  // 带小数点的优先
        }
        return b.value - a.value  // 数值大的优先（更可能是正确的）
      })
      mergedData.shanghaiIndex = shanghaiIndexCandidates[0].value
      console.log(`合并结果：选择上证指数 ${mergedData.shanghaiIndex} (带小数点: ${shanghaiIndexCandidates[0].hasDecimal})`)
    }

    return {
      success: true,
      data: mergedData,
      rawText: results.map(r => r.rawText).join('\n\n'),
      hasValidData: !!(mergedData.totalAsset || mergedData.totalMarketValue || mergedData.shanghaiIndex)
    }
  } catch (error) {
    console.error('批量识别失败:', error)
    return {
      success: false,
      error: error.message || '批量识别失败',
      rawText: '',
      hasValidData: false
    }
  }
}

/**
 * 清理 OCR 缓存（释放内存）
 * 终止 Tesseract Worker 以释放资源
 */
export const cleanupOCR = async () => {
  try {
    if (worker) {
      console.log('正在终止 Tesseract Worker...')
      await worker.terminate()
      worker = null
      workerInitialized = false
      console.log('✅ OCR Worker 已清理')
    }
  } catch (error) {
    console.error('清理 OCR Worker 失败:', error)
  }
}
