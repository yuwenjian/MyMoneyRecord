# 🎯 图表 X 轴日期重复问题 - 快速修复指南

## 问题现象

```
X轴显示：
2025-12-22  ← 第1次
2025-12-22  ← 第2次（重复！）
2025-12-23  ← 第1次
2025-12-23  ← 第2次（重复！）
```

## 根本原因

**同一天有两条记录（股票 + 基金），但为每条记录都生成了一个标签！**

```javascript
// ❌ 旧代码
sortedFiltered.forEach((record) => {
  labels.push('2025-12-22')  // 为股票添加标签
})
// 再次循环
sortedFiltered.forEach((record) => {
  labels.push('2025-12-22')  // 为基金添加标签 → 重复！
})
```

## 修复方案

**核心思路：先按日期分组，每个日期只生成一个标签**

```javascript
// ✅ 新代码
// 步骤1: 按日期分组
const dateRecordsMap = new Map()
sortedFiltered.forEach((record) => {
  if (!dateRecordsMap.has(record.date)) {
    dateRecordsMap.set(record.date, { stock: null, fund: null })
  }
  dateRecordsMap.get(record.date)[record.investmentType] = record
})

// 步骤2: 每个日期只生成一个标签
Array.from(dateRecordsMap.keys()).sort().forEach(date => {
  labels.push(date)  // ✅ 每个日期只出现一次
  
  const { stock, fund } = dateRecordsMap.get(date)
  // 同时处理股票和基金数据
})
```

## 数据结构对比

### 修复前

```javascript
labels = ['2025-12-22', '2025-12-22', '2025-12-23', '2025-12-23']
stockData = [0.5, null, 0.7, null]
fundData = [null, 0.3, null, 0.4]
```

### 修复后

```javascript
labels = ['2025-12-22', '2025-12-23']  // ✅ 不重复
stockData = [0.5, 0.7]
fundData = [0.3, 0.4]
```

## 修改的文件

### 1. src/utils/chartUtils.js

**修复聚合函数，按"日期+类型"分组**

```javascript
const groupKey = `${key}-${record.investmentType}`
```

### 2. src/pages/StatisticsPage.jsx

**重构标签生成逻辑，按日期分组**

```javascript
// 使用 Map 按日期分组
const dateRecordsMap = new Map()
// ... 分组逻辑 ...

// 每个日期只生成一个标签
Array.from(dateRecordsMap.keys()).sort().forEach(date => {
  labels.push(date)  // ✅ 关键修复
})
```

## 测试验证

### 预期效果

```
场景：2025-12-22 有股票和基金两条记录

修复前：
  X轴: 2025-12-22, 2025-12-22  ❌

修复后：
  X轴: 2025-12-22  ✅
  红色曲线: 有值
  绿色曲线: 有值
```

## 快速检查

1. ✅ 打开统计分析页面
2. ✅ 查看"股票与基金收益对比"图表
3. ✅ 检查 X 轴日期是否还有重复

---

## 🎉 修复完成！

**两处关键修复：**
1. ✅ `aggregateByPeriod`: 按"日期+类型"分组
2. ✅ `updateChart`: 使用 Map 按日期分组生成标签

**效果：**
- ✅ X 轴日期不再重复
- ✅ 数据正确对齐
- ✅ 性能优化

**🚀 请刷新页面测试！**

