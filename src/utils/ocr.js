import { createWorker } from 'tesseract.js'

/**
 * OCR 图片识别工具 - 全新简化版
 * 使用免费开源的 Tesseract.js 进行文字识别
 * 重新设计的识别算法：更简单、更可靠
 */

// 创建 Tesseract OCR worker（单例模式）
let worker = null

/**
 * 初始化 OCR Worker
 */
const initWorker = async () => {
  if (!worker) {
    console.log('初始化 Tesseract OCR Worker...')
    
    worker = await createWorker('chi_sim+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(m.progress * 100)
          if (progress % 25 === 0 || progress === 100) {
            console.log(`OCR识别进度: ${progress}%`)
          }
        }
      }
    })
    
    // 优化识别参数，适合手机截图，减少乱码
    await worker.setParameters({
      // 尝试不同的PSM模式，找到最适合的
      // 6 = 统一文本块（适合单列文本）
      // 11 = 稀疏文本（适合不规则布局）
      // 13 = 原始行（适合表格）
      tessedit_pageseg_mode: '11', // 改为稀疏文本模式，可能更适合手机截图
      
      // 🆕 移除字符白名单限制，让OCR自由识别（减少乱码）
      // 字符白名单可能会限制识别，导致误识别
      // tessedit_char_whitelist: '...', // 注释掉，让OCR自由识别
      
      preserve_interword_spaces: '1',
      tessedit_ocr_engine_mode: '1', // LSTM OCR 引擎
      
      // 🆕 添加更多优化参数
      classify_bln_numeric_mode: '0', // 不强制数字模式
      textord_min_linesize: '2.5', // 最小行大小
    })
    
    console.log('Tesseract OCR Worker 初始化完成')
  }
  return worker
}

/**
 * 图片预处理：增强版，提高识别准确率，减少乱码
 */
const preprocessImage = async (image) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // 如果图片太大，适当缩放以提高识别速度（但保持清晰度）
        const maxWidth = 2000
        const maxHeight = 2000
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }
        
        canvas.width = width
        canvas.height = height
        
        // 使用高质量渲染
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // 转换为灰度图并增强
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i]
          let g = data[i + 1]
          let b = data[i + 2]
          
          // 转换为灰度
          const gray = 0.299 * r + 0.587 * g + 0.114 * b
          
          // 增强对比度（更激进）
          const contrast = 1.5
          const enhanced = Math.min(255, Math.max(0, (gray - 128) * contrast + 128))
          
          // 二值化处理（提高文字清晰度）
          const threshold = 128
          const binary = enhanced > threshold ? 255 : 0
          
          // 应用结果
          data[i] = binary
          data[i + 1] = binary
          data[i + 2] = binary
          // alpha 保持不变
        }
        
        ctx.putImageData(imageData, 0, 0)
        
        canvas.toBlob((blob) => {
          const processedImg = new Image()
          processedImg.onload = () => resolve(processedImg)
          processedImg.onerror = reject
          processedImg.src = URL.createObjectURL(blob)
        }, 'image/png')
      } catch (error) {
        console.warn('图片预处理失败，使用原图:', error)
        resolve(img)
      }
    }
    
    img.onerror = reject
    
    if (image instanceof File) {
      img.src = URL.createObjectURL(image)
    } else if (typeof image === 'string') {
      img.src = image
    } else {
      reject(new Error('不支持的图片格式'))
    }
  })
}

/**
 * 清理识别文本：过滤明显的乱码
 */
const cleanRecognizedText = (text) => {
  if (!text) return text
  
  const lines = text.split('\n')
  const cleanedLines = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    // 过滤明显的乱码行：
    // 1. 只有无意义的字母组合（超过5个连续字母，且不是常见单词）
    // 2. 包含大量随机字符的行
    const randomCharPattern = /[a-zA-Z]{6,}/g
    const randomMatches = trimmed.match(randomCharPattern)
    
    // 如果一行中超过50%是随机字母组合，可能是乱码
    if (randomMatches) {
      const randomCharCount = randomMatches.join('').length
      if (randomCharCount / trimmed.length > 0.5) {
        console.log(`过滤乱码行: "${trimmed}"`)
        continue
      }
    }
    
    // 保留包含中文、数字或常见关键词的行
    if (/[\u4e00-\u9fa5]/.test(trimmed) || /\d/.test(trimmed) || 
        /总资产|总市值|上证指数|盈亏|收益/i.test(trimmed)) {
      cleanedLines.push(trimmed)
    }
  }
  
  return cleanedLines.join('\n')
}

/**
 * 识别图片中的文本
 */
export const recognizeText = async (image) => {
  try {
    console.log('开始 OCR 识别...')
    const ocr = await initWorker()
    
    // 图片预处理（增强版）
    let imageToRecognize = image
    if (image instanceof File) {
      try {
        console.log('对图片进行增强预处理...')
        const processedImg = await preprocessImage(image)
        imageToRecognize = processedImg.src
      } catch (error) {
        console.warn('图片预处理失败，使用原图')
      }
    }
    
    // 执行 OCR 识别
    const startTime = Date.now()
    const { data } = await ocr.recognize(imageToRecognize, {
      rectangle: undefined,
    })
    
    let text = data.text.trim()
    
    // 🆕 清理识别文本，过滤乱码
    console.log('清理识别文本，过滤乱码...')
    const originalLength = text.length
    text = cleanRecognizedText(text)
    const cleanedLength = text.length
    
    if (originalLength !== cleanedLength) {
      console.log(`文本清理: ${originalLength} 字符 → ${cleanedLength} 字符`)
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log('OCR识别完成')
    console.log(`识别文本长度: ${text.length} 字符`)
    console.log(`识别置信度: ${Math.round(data.confidence || 0)}%`)
    console.log(`识别耗时: ${duration} 秒`)
    
    // 清理临时 URL
    if (imageToRecognize !== image && imageToRecognize.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRecognize)
    }
    
    return text
  } catch (error) {
    console.error('OCR识别失败:', error)
    throw new Error(`图片识别失败: ${error.message || '未知错误'}`)
  }
}

/**
 * 从文本中提取数字（增强版：支持千分位）
 */
const extractNumber = (text) => {
  if (!text) return null
  
  // 🆕 优先匹配带千分位的数字（如 167,577.42）
  const commaNumberMatch = text.match(/(\d{1,3}(?:,\d{3})+\.?\d*)/)
  if (commaNumberMatch) {
    const num = parseFloat(commaNumberMatch[1].replace(/,/g, ''))
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
  
  // 返回最大的数字（通常是金额）
  return Math.max(...numbers)
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
 * @param {string} originalText - 原始文本（用于检查是否有小数点）
 */
const isStockCode = (num, originalText = '') => {
  // 🆕 修复：如果原始文本包含小数点，即使提取后是整数，也不应该是股票代码
  // 例如："107,954.00" 提取后是 107954，但原始文本有小数点，所以不是股票代码
  if (originalText && /\./.test(originalText)) {
    return false
  }
  
  // 6位整数（100000-999999）且没有小数点，可能是股票代码
  // 但是，如果数字在合理范围内（可能是金额），不应该被当作股票代码
  // 例如：107954 可能是总市值，不应该被过滤
  if (num >= 100000 && num < 1000000 && Number.isInteger(num)) {
    // 🆕 如果数字在合理范围内（可能是金额），不当作股票代码
    // 总市值通常在 10000-1000000 之间
    if (num >= 10000 && num < 1000000) {
      // 如果数字看起来像金额（不是纯6位整数，或者有上下文），不当作股票代码
      return false
    }
    return true
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
  ]
  return patterns.some(p => p.test(line)) && !line.includes('市值')
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
  ]
  return patterns.some(p => p.test(line)) && !line.includes('总资产')
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
 * 全新的简化识别算法（增强版：支持OCR识别错误和智能推断）
 * 规则：找到关键词行，然后提取紧邻的数字
 * 如果关键词匹配失败，从大数字中智能推断
 */
const parseDataSimple = (text, investmentType = 'stock') => {
  const lines = text.split('\n').filter(line => line.trim())
  const result = {
    totalAsset: null,
    totalMarketValue: null,
    shanghaiIndex: null,
  }

  console.log('======== 开始解析数据（增强算法）========')
  console.log('投资类型:', investmentType === 'stock' ? '股票' : '基金')
  console.log('文本行数:', lines.length)
  console.log('完整文本:', text)

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

  // 逐行查找关键词
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    console.log(`行[${i}]: "${line}"`)

    // 1. 总资产识别（支持OCR识别错误）
    if (!result.totalAsset) {
      if (investmentType === 'stock') {
        // 股票模式：查找"总资产"（支持OCR错误，如"资多帐户"）
        if (isTotalAssetLine(line) && !isExcludeLine(line)) {
          console.log(`  → 发现"总资产"相关关键词（可能OCR识别错误）`)
          
          // 先尝试当前行
          let num = extractNumber(line)
          if (num && num >= 1000) {
            result.totalAsset = num
            console.log(`  ✅ 从当前行提取总资产: ${num}`)
            
            // 🆕 关键优化：总资产识别后，立即检查下一行是否是总市值
            if (i + 1 < lines.length && !result.totalMarketValue) {
              const nextLine = lines[i + 1].trim()
              const nextNum = extractNumber(nextLine)
              if (nextNum && nextNum >= 100 && nextNum < num && !isStockCode(nextNum, nextLine)) {
                // 如果下一行的数字小于总资产且在合理范围内，可能是总市值
                if (!profitLossNum || Math.abs(nextNum - profitLossNum) > 0.01) {
                  result.totalMarketValue = nextNum
                  console.log(`  ✅ 从总资产下一行提取总市值: ${nextNum}`)
                }
              }
            }
            continue
          }
          
          // 尝试下一行
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim()
            if (!isExcludeLine(nextLine)) {
              num = extractNumber(nextLine)
              if (num && num >= 1000) {
                result.totalAsset = num
                console.log(`  ✅ 从下一行提取总资产: ${num}`)
                
                // 🆕 关键优化：总资产识别后，立即检查再下一行是否是总市值
                if (i + 2 < lines.length && !result.totalMarketValue) {
                  const nextLine2 = lines[i + 2].trim()
                  const nextNum2 = extractNumber(nextLine2)
                  if (nextNum2 && nextNum2 >= 100 && nextNum2 < num && !isStockCode(nextNum2, nextLine2)) {
                    if (!profitLossNum || Math.abs(nextNum2 - profitLossNum) > 0.01) {
                      result.totalMarketValue = nextNum2
                      console.log(`  ✅ 从总资产下两行提取总市值: ${nextNum2}`)
                    }
                  }
                }
                continue
              }
            }
          }
          
          // 尝试第2行
          if (i + 2 < lines.length) {
            const nextLine2 = lines[i + 2].trim()
            if (!isExcludeLine(nextLine2)) {
              num = extractNumber(nextLine2)
              if (num && num >= 1000) {
                result.totalAsset = num
                console.log(`  ✅ 从第2行提取总资产: ${num}`)
                
                // 🆕 关键优化：总资产识别后，立即检查再下一行是否是总市值
                if (i + 3 < lines.length && !result.totalMarketValue) {
                  const nextLine3 = lines[i + 3].trim()
                  const nextNum3 = extractNumber(nextLine3)
                  if (nextNum3 && nextNum3 >= 100 && nextNum3 < num && !isStockCode(nextNum3, nextLine3)) {
                    if (!profitLossNum || Math.abs(nextNum3 - profitLossNum) > 0.01) {
                      result.totalMarketValue = nextNum3
                      console.log(`  ✅ 从总资产下三行提取总市值: ${nextNum3}`)
                    }
                  }
                }
                continue
              }
            }
          }
        }
      } else {
        // 基金模式：查找"基金资产"
        if (/基金.*资产|基金.*总额/i.test(line) && !isExcludeLine(line)) {
          console.log(`  → 发现"基金资产"关键词`)
          
          let num = extractNumber(line)
          if (num && num >= 1000) {
            result.totalAsset = num
            console.log(`  ✅ 从当前行提取总资产: ${num}`)
            continue
          }
          
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim()
            if (!isExcludeLine(nextLine)) {
              num = extractNumber(nextLine)
              if (num && num >= 1000) {
                result.totalAsset = num
                console.log(`  ✅ 从下一行提取总资产: ${num}`)
                continue
              }
            }
          }
        }
      }
    }

    // 2. 总市值识别（仅股票模式，支持OCR识别错误）
    if (investmentType === 'stock' && !result.totalMarketValue) {
      if (isTotalMarketValueLine(line) && !isExcludeLine(line)) {
        console.log(`  → 发现"总市值"相关关键词`)
        
        // 先尝试下一行（总市值通常在关键词的下一行）
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          
          // 如果下一行是"总盈亏"，跳过
          if (!/总盈亏|总.*盈亏/i.test(nextLine) && !isExcludeLine(nextLine)) {
            let num = extractNumber(nextLine)
            
            // 排除股票代码和总盈亏数字
            if (num && num >= 100 && !isStockCode(num, line)) {
              if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
                result.totalMarketValue = num
                console.log(`  ✅ 从下一行提取总市值: ${num}`)
                continue
              } else {
                console.log(`  ✗ 数字 ${num} 与总盈亏 ${profitLossNum} 相同，跳过`)
              }
            }
          }
        }
        
        // 如果下一行没找到，尝试当前行
        let num = extractNumber(line)
        if (num && num >= 100 && !isStockCode(num, line)) {
          if (!profitLossNum || Math.abs(num - profitLossNum) > 0.01) {
            result.totalMarketValue = num
            console.log(`  ✅ 从当前行提取总市值: ${num}`)
            continue
          }
        }
      }
    }

    // 3. 上证指数识别（增强：检查上一行和下一行，优先选择带小数点的数字）
    if (!result.shanghaiIndex) {
      if (/上证指数|沪指|上证/i.test(line)) {
        console.log(`  → 发现"上证指数"关键词行[${i}]: "${line}"`)
        
        // 🆕 收集所有候选数字（带位置信息）
        const candidates = []
        
        // 🆕 关键修复：上证指数的数字通常在关键词的上一行（如 4112.60 在"上证指数"上方）
        // 先尝试上一行
        if (i > 0) {
          const prevLine = lines[i - 1].trim()
          console.log(`  → 检查上一行[${i - 1}]: "${prevLine}"`)
          let num = extractNumber(prevLine)
          if (num && num > 2000 && num < 5000) {
            // 🆕 严格排除股票代码：检查行中是否包含股票代码特征
            const hasStockCode = /^\d{6}/.test(prevLine) || 
                                /\d{6}\s*融/.test(prevLine) || 
                                /创\s*\d{6}/.test(prevLine) ||
                                /创\s*\d{5,6}/.test(prevLine) ||
                                /\d{5,6}\s*融/.test(prevLine) ||
                                // 🆕 检查数字是否可能是股票代码的一部分（如 3013 可能是 301333 的一部分）
                                (/\d{5,6}/.test(prevLine) && !/\./.test(prevLine))
            
            // 🆕 额外检查：如果数字是4位整数且行中包含"创"或"融"，很可能是股票代码的一部分
            const isLikelyStockCode = Number.isInteger(num) && 
                                     num >= 2000 && num < 10000 && 
                                     !/\./.test(prevLine) &&
                                     (/创|融|股票|代码/.test(prevLine))
            
            if (!hasStockCode && !isLikelyStockCode) {
              const hasDecimal = /\./.test(prevLine)
              candidates.push({
                num,
                line: prevLine,
                lineIndex: i - 1,
                hasDecimal,
                priority: hasDecimal ? 2 : 0  // 带小数点的优先级更高
              })
              console.log(`    ✓ 候选数字: ${num} (带小数点: ${hasDecimal})`)
            } else {
              console.log(`    ✗ 跳过：疑似股票代码 (hasStockCode: ${hasStockCode}, isLikelyStockCode: ${isLikelyStockCode})`)
            }
          }
        }
        
        // 尝试当前行
        let num = extractNumber(line)
        if (num && num > 2000 && num < 5000) {
          const hasStockCode = /^\d{6}/.test(line) || /\d{6}\s*融/.test(line) || /创\s*\d{6}/.test(line) ||
                               /创\s*\d{5,6}/.test(line) || /\d{5,6}\s*融/.test(line) ||
                               (/\d{5,6}/.test(line) && !/\./.test(line))
          const isLikelyStockCode = Number.isInteger(num) && num >= 2000 && num < 10000 && 
                                   !/\./.test(line) && (/创|融|股票|代码/.test(line))
          
          if (!hasStockCode && !isLikelyStockCode) {
            const hasDecimal = /\./.test(line)
            candidates.push({
              num,
              line: line,
              lineIndex: i,
              hasDecimal,
              priority: hasDecimal ? 2 : 0
            })
            console.log(`    ✓ 候选数字: ${num} (带小数点: ${hasDecimal})`)
          } else {
            console.log(`    ✗ 跳过：疑似股票代码`)
          }
        }
        
        // 尝试下一行
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
          console.log(`  → 检查下一行[${i + 1}]: "${nextLine}"`)
          num = extractNumber(nextLine)
          if (num && num > 2000 && num < 5000) {
            const hasStockCode = /^\d{6}/.test(nextLine) || /\d{6}\s*融/.test(nextLine) || /创\s*\d{6}/.test(nextLine) ||
                                 /创\s*\d{5,6}/.test(nextLine) || /\d{5,6}\s*融/.test(nextLine) ||
                                 (/\d{5,6}/.test(nextLine) && !/\./.test(nextLine))
            const isLikelyStockCode = Number.isInteger(num) && num >= 2000 && num < 10000 && 
                                     !/\./.test(nextLine) && (/创|融|股票|代码/.test(nextLine))
            
            if (!hasStockCode && !isLikelyStockCode) {
              const hasDecimal = /\./.test(nextLine)
              candidates.push({
                num,
                line: nextLine,
                lineIndex: i + 1,
                hasDecimal,
                priority: hasDecimal ? 2 : 0
              })
              console.log(`    ✓ 候选数字: ${num} (带小数点: ${hasDecimal})`)
            } else {
              console.log(`    ✗ 跳过：疑似股票代码`)
            }
          }
        }
        
        // 🆕 尝试第2行和第3行（扩大搜索范围）
        for (let offset = 2; offset <= 3; offset++) {
          if (i + offset < lines.length) {
            const candidateLine = lines[i + offset].trim()
            console.log(`  → 检查第${offset}行[${i + offset}]: "${candidateLine}"`)
            num = extractNumber(candidateLine)
            if (num && num > 2000 && num < 5000) {
              const hasStockCode = /^\d{6}/.test(candidateLine) || /\d{6}\s*融/.test(candidateLine) || /创\s*\d{6}/.test(candidateLine) ||
                                   /创\s*\d{5,6}/.test(candidateLine) || /\d{5,6}\s*融/.test(candidateLine) ||
                                   (/\d{5,6}/.test(candidateLine) && !/\./.test(candidateLine))
              const isLikelyStockCode = Number.isInteger(num) && num >= 2000 && num < 10000 && 
                                       !/\./.test(candidateLine) && (/创|融|股票|代码/.test(candidateLine))
              
              if (!hasStockCode && !isLikelyStockCode) {
                const hasDecimal = /\./.test(candidateLine)
                candidates.push({
                  num,
                  line: candidateLine,
                  lineIndex: i + offset,
                  hasDecimal,
                  priority: hasDecimal ? 2 : 0
                })
                console.log(`    ✓ 候选数字: ${num} (带小数点: ${hasDecimal})`)
              } else {
                console.log(`    ✗ 跳过：疑似股票代码`)
              }
            }
          }
        }
        
        // 🆕 从候选数字中选择最佳结果：优先选择带小数点的，其次选择上一行的
        if (candidates.length > 0) {
          console.log(`  找到 ${candidates.length} 个候选数字:`, candidates.map(c => `${c.num} (行[${c.lineIndex}], 带小数点: ${c.hasDecimal})`))
          
          // 按优先级排序：带小数点的优先，然后按距离排序（上一行 > 当前行 > 下一行）
          candidates.sort((a, b) => {
            if (a.priority !== b.priority) {
              return b.priority - a.priority  // 带小数点的优先（priority 2 > 0）
            }
            // 如果优先级相同，优先选择上一行的（因为数字通常在关键词上方）
            if (a.lineIndex < i && b.lineIndex >= i) return -1
            if (a.lineIndex >= i && b.lineIndex < i) return 1
            return Math.abs(a.lineIndex - i) - Math.abs(b.lineIndex - i)  // 距离关键词越近越好
          })
          
          result.shanghaiIndex = candidates[0].num
          console.log(`  ✅✅✅ 从行[${candidates[0].lineIndex}]提取上证指数: ${candidates[0].num} (带小数点: ${candidates[0].hasDecimal}, 文本: "${candidates[0].line}")`)
          continue
        } else {
          console.log(`  ✗ 未找到符合条件的候选数字`)
        }
      }
    }
  }

  // 🆕 智能推断：如果关键词匹配失败，从大数字中推断
  if (investmentType === 'stock') {
    // 如果总资产未识别，尝试从大数字中推断
    if (!result.totalAsset) {
      console.log('总资产关键词匹配失败，尝试智能推断...')
      const largeNumbers = inferFromLargeNumbers(lines, profitLossNum)
      if (largeNumbers.length > 0) {
        // 最大的数字通常是总资产
        result.totalAsset = largeNumbers[0].value
        const totalAssetLineIndex = largeNumbers[0].lineIndex
        console.log(`  ✅ 智能推断总资产: ${result.totalAsset} (行[${totalAssetLineIndex}])`)
        
        // 🆕 关键优化：总资产识别后，立即检查下一行是否是总市值
        if (totalAssetLineIndex + 1 < lines.length && !result.totalMarketValue) {
          const nextLine = lines[totalAssetLineIndex + 1].trim()
          const nextNum = extractNumber(nextLine)
          if (nextNum && nextNum >= 100 && nextNum < result.totalAsset && !isStockCode(nextNum, nextLine)) {
            if (!profitLossNum || Math.abs(nextNum - profitLossNum) > 0.01) {
              result.totalMarketValue = nextNum
              console.log(`  ✅ 从总资产下一行提取总市值: ${nextNum} (行[${totalAssetLineIndex + 1}])`)
            }
          }
        }
      }
    }
    
    // 🆕 如果总市值未识别，优先检查总资产的下一行
    if (!result.totalMarketValue && result.totalAsset) {
      console.log(`总资产已识别: ${result.totalAsset}，查找总市值...`)
      
      // 先找到总资产所在的行（支持容差匹配）
      let totalAssetLineIndex = -1
      for (let idx = 0; idx < lines.length; idx++) {
        const num = extractNumber(lines[idx].trim())
        if (num && Math.abs(num - result.totalAsset) < 0.01) {
          totalAssetLineIndex = idx
          console.log(`  找到总资产所在行[${idx}]: "${lines[idx].trim()}"`)
          break
        }
      }
      
      if (totalAssetLineIndex !== -1 && totalAssetLineIndex + 1 < lines.length) {
        const nextLine = lines[totalAssetLineIndex + 1].trim()
        console.log(`  检查下一行[${totalAssetLineIndex + 1}]: "${nextLine}"`)
        const nextNum = extractNumber(nextLine)
        console.log(`  提取的数字: ${nextNum}`)
        
        if (nextNum) {
          console.log(`  验证条件:`)
          console.log(`    - 数字 >= 100: ${nextNum >= 100}`)
          console.log(`    - 数字 < 总资产: ${nextNum < result.totalAsset}`)
          console.log(`    - 不是股票代码: ${!isStockCode(nextNum)}`)
          console.log(`    - 不是总盈亏: ${!profitLossNum || Math.abs(nextNum - profitLossNum) > 0.01}`)
        }
        
        // 🆕 修复：传递原始文本给 isStockCode 函数
        const isStockCodeResult = isStockCode(nextNum, nextLine)
        console.log(`    - 不是股票代码: ${!isStockCodeResult} (原始文本: "${nextLine}")`)
        
        if (nextNum && nextNum >= 100 && nextNum < result.totalAsset && !isStockCodeResult) {
          if (!profitLossNum || Math.abs(nextNum - profitLossNum) > 0.01) {
            result.totalMarketValue = nextNum
            console.log(`  ✅✅✅ 从总资产下一行提取总市值: ${nextNum} (行[${totalAssetLineIndex + 1}])`)
          } else {
            console.log(`  ✗ 数字 ${nextNum} 与总盈亏 ${profitLossNum} 相同，跳过`)
          }
        } else {
          console.log(`  ✗ 数字 ${nextNum} 不满足条件 (是股票代码: ${isStockCodeResult})`)
        }
      } else {
        console.log(`  ✗ 未找到总资产所在行或下一行不存在`)
      }
    }
    
    // 如果总市值仍未识别，尝试从大数字中推断
    if (!result.totalMarketValue) {
      console.log('总市值关键词匹配失败，尝试智能推断...')
      const largeNumbers = inferFromLargeNumbers(lines, profitLossNum)
      
      if (result.totalAsset) {
        // 如果总资产已识别，过滤掉总资产，选择第二大的数字作为总市值
        const candidates = largeNumbers.filter(n => 
          Math.abs(n.value - result.totalAsset) > 0.01 && 
          n.value < result.totalAsset && 
          n.value >= result.totalAsset * 0.1  // 总市值应该在总资产的10%以上
        )
        
        if (candidates.length > 0) {
          // 选择最大的候选数字
          result.totalMarketValue = candidates[0].value
          console.log(`  ✅ 智能推断总市值: ${result.totalMarketValue} (行[${candidates[0].lineIndex}])`)
        }
      } else {
        // 如果总资产未识别，选择第二大的数字作为总市值（假设最大的会是总资产）
        if (largeNumbers.length >= 2) {
          result.totalMarketValue = largeNumbers[1].value
          console.log(`  ✅ 智能推断总市值: ${result.totalMarketValue} (行[${largeNumbers[1].lineIndex}])`)
        }
      }
    }
  }
  
  // 🆕 如果上证指数未识别，从整个文本中搜索符合条件的数字
  if (!result.shanghaiIndex) {
    console.log('上证指数关键词匹配失败，尝试从整个文本中搜索...')
    
    // 🆕 首先检查原始文本中是否有 4112.60 这样的数字（支持小数点）
    const fullText = lines.join('\n')
    const indexPatterns = [
      /(\d{4}\.\d{1,2})/,  // 4112.60
      /(\d{4})/,            // 4112
    ]
    
    for (const pattern of indexPatterns) {
      const matches = fullText.match(new RegExp(pattern.source, 'g'))
      if (matches) {
        for (const match of matches) {
          const num = parseFloat(match)
          if (num && num > 2000 && num < 5000) {
            // 检查这个数字是否在包含"指数"关键词的行附近（前后100字符）
            const matchIndex = fullText.indexOf(match)
            const beforeText = fullText.substring(Math.max(0, matchIndex - 100), matchIndex)
            const afterText = fullText.substring(matchIndex, Math.min(fullText.length, matchIndex + 100))
            
            if (/指数|沪指|上证/i.test(beforeText) || /指数|沪指|上证/i.test(afterText)) {
              result.shanghaiIndex = num
              console.log(`  ✅✅✅ 从文本中提取上证指数: ${num} (匹配: ${match}, 在指数关键词附近)`)
              break
            }
          }
        }
        if (result.shanghaiIndex) break
      }
    }
    
    // 如果还没找到，从所有行中搜索符合条件的数字（2000-5000范围）
    if (!result.shanghaiIndex) {
      const candidates = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        const num = extractNumber(line)
        
        // 检查是否是上证指数范围（2000-5000）
        if (num && num > 2000 && num < 5000) {
          console.log(`  行[${i}]: "${line}" → 数字: ${num}`)
          
          // 🆕 严格排除股票代码：如果行中包含股票代码特征，跳过
          const hasStockCode = /^\d{6}/.test(line) || /\d{6}\s*融/.test(line) || /创\s*\d{6}/.test(line) || 
                               /\d{5,6}\s*融/.test(line) || /创\s*\d{5,6}/.test(line) ||
                               (/\d{5,6}/.test(line) && !/\./.test(line))
          
          // 🆕 额外检查：如果数字是4位整数且行中包含"创"或"融"，很可能是股票代码的一部分
          const isLikelyStockCode = Number.isInteger(num) && 
                                   num >= 2000 && num < 10000 && 
                                   !/\./.test(line) &&
                                   (/创|融|股票|代码/.test(line))
          
          if (hasStockCode || isLikelyStockCode) {
            console.log(`    ✗ 跳过：包含股票代码特征 (hasStockCode: ${hasStockCode}, isLikelyStockCode: ${isLikelyStockCode})`)
            continue
          }
          
          // 排除明显的其他数字（如年份、价格等）
          // 如果行中包含"指数"相关关键词，优先选择
          // 🆕 检查当前行、上一行、下一行是否包含指数关键词
          const hasIndexKeyword = /指数|沪指|上证/i.test(line) || 
                                  (i > 0 && /指数|沪指|上证/i.test(lines[i - 1])) ||
                                  (i < lines.length - 1 && /指数|沪指|上证/i.test(lines[i + 1]))
          
          const hasDecimal = /\./.test(line)
          
          if (hasIndexKeyword) {
            candidates.push({
              num,
              line,
              lineIndex: i,
              hasDecimal,
              priority: hasIndexKeyword ? 2 : (hasDecimal ? 1 : 0)  // 包含关键词的优先级最高
            })
          }
        }
      }
      
      // 🆕 从候选数字中选择最佳结果：优先选择包含关键词且带小数点的
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority
          }
          return b.hasDecimal - a.hasDecimal  // 带小数点的优先
        })
        
        result.shanghaiIndex = candidates[0].num
        console.log(`  ✅✅✅ 从行[${candidates[0].lineIndex}]提取上证指数: ${candidates[0].num} (包含关键词, 带小数点: ${candidates[0].hasDecimal})`)
      }
    }
    
    // 如果还没找到，选择第一个符合条件的数字（带小数点或3000-5000之间）
    if (!result.shanghaiIndex) {
      console.log('未找到包含指数关键词的数字，尝试智能推断...')
      const candidates = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        const num = extractNumber(line)
        
        if (num && num > 2000 && num < 5000) {
          console.log(`  行[${i}]: "${line}" → 数字: ${num}`)
          
          // 🆕 排除股票代码
          const hasStockCode = /^\d{6}/.test(line) || /\d{6}\s*融/.test(line) || /创\s*\d{6}/.test(line) || 
                               /\d{5,6}\s*融/.test(line) || /创\s*\d{5,6}/.test(line)
          
          if (hasStockCode) {
            console.log(`    ✗ 跳过：包含股票代码特征`)
            continue
          }
          
          // 🆕 如果原始文本包含小数点，优先选择（如 4112.60）
          const hasDecimal = /\./.test(line)
          // 如果数字是4位数且带小数点，可能是上证指数
          // 或者数字在3000-5000之间（更可能是上证指数）
          const inRange = num >= 3000 && num < 5000
          
          if (hasDecimal || inRange) {
            candidates.push({
              num,
              line,
              lineIndex: i,
              hasDecimal,
              priority: hasDecimal ? 1 : 0
            })
          }
        }
      }
      
      // 🆕 从候选数字中选择最佳结果：优先选择带小数点的
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority  // 带小数点的优先
          }
          return b.num - a.num  // 数值大的优先（更可能是上证指数）
        })
        
        result.shanghaiIndex = candidates[0].num
        console.log(`  ✅✅✅ 智能推断上证指数: ${candidates[0].num} (行[${candidates[0].lineIndex}], 带小数点: ${candidates[0].hasDecimal})`)
      }
    }
    
    if (!result.shanghaiIndex) {
      console.log('  ✗ 未找到符合条件的上证指数')
    }
  }

  console.log('======== 解析结果 ========')
  console.log('总资产:', result.totalAsset || '未识别')
  console.log('总市值:', result.totalMarketValue || (investmentType === 'fund' ? '（基金模式不识别）' : '未识别'))
  console.log('上证指数:', result.shanghaiIndex || '未识别')
  console.log('========================')

  return result
}

/**
 * 解析股票数据
 */
const parseStockData = (text) => {
  return parseDataSimple(text, 'stock')
}

/**
 * 解析基金数据
 */
const parseFundData = (text) => {
  return parseDataSimple(text, 'fund')
}

/**
 * 主要的 OCR 识别和数据解析函数
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

    // 3. 返回结果
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
    const mergedData = {
      totalAsset: null,
      totalMarketValue: null,
      shanghaiIndex: null,
    }

    for (const result of results) {
      if (result.success && result.data) {
        if (!mergedData.totalAsset && result.data.totalAsset) {
          mergedData.totalAsset = result.data.totalAsset
        }
        if (!mergedData.totalMarketValue && result.data.totalMarketValue) {
          mergedData.totalMarketValue = result.data.totalMarketValue
        }
        if (!mergedData.shanghaiIndex && result.data.shanghaiIndex) {
          mergedData.shanghaiIndex = result.data.shanghaiIndex
        }
      }
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
 * 清理 OCR worker（释放内存）
 */
export const cleanupOCR = async () => {
  if (worker) {
    await worker.terminate()
    worker = null
    console.log('OCR Worker 已清理')
  }
}
