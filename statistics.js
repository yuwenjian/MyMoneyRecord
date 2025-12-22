// 数据存储键名
const STORAGE_KEY_RECORDS = 'investment_records';
const STORAGE_KEY_ADJUSTMENTS = 'investment_adjustments';

let trendChart = null;
let startDatePicker = null;
let endDatePicker = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化日期选择器
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    startDatePicker = flatpickr(startDateInput, {
        locale: 'zh',
        dateFormat: 'Y年m月d日',
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates[0]) {
                startDateInput.setAttribute('data-date-value', selectedDates[0].toISOString().split('T')[0]);
            }
        }
    });
    
    endDatePicker = flatpickr(endDateInput, {
        locale: 'zh',
        dateFormat: 'Y年m月d日',
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates[0]) {
                endDateInput.setAttribute('data-date-value', selectedDates[0].toISOString().split('T')[0]);
            }
        }
    });

    // 设置默认日期范围：首次记录日期到当前日期
    const records = getRecords();
    if (records.length > 0) {
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstDate = new Date(sortedRecords[0].date);
        const lastDate = new Date(sortedRecords[sortedRecords.length - 1].date);
        
        // 设置开始日期为首次记录日期
        startDatePicker.setDate(firstDate, false);
        startDateInput.setAttribute('data-date-value', sortedRecords[0].date);
        
        // 设置结束日期为最新记录日期（或当前日期，取较新的）
        const today = new Date();
        const endDate = lastDate > today ? today : lastDate;
        endDatePicker.setDate(endDate, false);
        endDateInput.setAttribute('data-date-value', endDate.toISOString().split('T')[0]);
    }

    // 绑定事件
    document.getElementById('filterBtn').addEventListener('click', loadStatistics);
    document.getElementById('resetBtn').addEventListener('click', resetDateRange);

    // 加载统计数据
    loadStatistics();
});

// 重置日期范围
function resetDateRange() {
    const records = getRecords();
    if (records.length > 0) {
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstDate = new Date(sortedRecords[0].date);
        const lastDate = new Date(sortedRecords[sortedRecords.length - 1].date);
        
        // 设置开始日期为首次记录日期
        startDatePicker.setDate(firstDate, false);
        document.getElementById('startDate').setAttribute('data-date-value', sortedRecords[0].date);
        
        // 设置结束日期为最新记录日期（或当前日期，取较新的）
        const today = new Date();
        const endDate = lastDate > today ? today : lastDate;
        endDatePicker.setDate(endDate, false);
        document.getElementById('endDate').setAttribute('data-date-value', endDate.toISOString().split('T')[0]);
    } else {
        startDatePicker.clear();
        endDatePicker.clear();
        document.getElementById('startDate').removeAttribute('data-date-value');
        document.getElementById('endDate').removeAttribute('data-date-value');
    }
    loadStatistics();
}

// 获取所有记录
function getRecords() {
    const records = localStorage.getItem(STORAGE_KEY_RECORDS);
    return records ? JSON.parse(records) : [];
}

// 获取所有加减仓记录
function getAdjustments() {
    const adjustments = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
    return adjustments ? JSON.parse(adjustments) : [];
}

// 计算每日盈亏
function calculateDailyProfitLoss(record, prevRecord, adjustments) {
    if (!prevRecord) {
        return 0; // 第一条记录没有盈亏
    }

    // 获取当天的加减仓金额
    const dayAdjustments = adjustments
        .filter(a => a.date === record.date)
        .reduce((sum, a) => sum + a.amount, 0);

    // 每日盈亏金额 = 今日总资产 - 加仓金额 + 减仓的金额 - 上个交易日记录总资产
    // 注意：减仓金额是负数，所以是 - 加仓金额 + 减仓金额 = -dayAdjustments
    // 但公式说的是"减仓的金额"，应该是绝对值，所以应该是：今日总资产 - 加仓金额 - 减仓金额 - 上个交易日总资产
    // 简化：今日总资产 - dayAdjustments - 上个交易日总资产
    const dailyProfitLoss = (record.totalAsset || 0) - dayAdjustments - (prevRecord.totalAsset || 0);
    
    return dailyProfitLoss;
}

// 加载统计数据
function loadStatistics() {
    const records = getRecords();
    const adjustments = getAdjustments();

    if (records.length === 0) {
        document.getElementById('chartPlaceholder').style.display = 'block';
        return;
    }

    // 获取日期范围
    const startDateValue = document.getElementById('startDate').getAttribute('data-date-value');
    const endDateValue = document.getElementById('endDate').getAttribute('data-date-value');

    // 排序记录
    const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 确定统计范围
    let filteredRecords = sortedRecords;
    let dateRangeText = '全部';
    
    if (startDateValue || endDateValue) {
        filteredRecords = sortedRecords.filter(record => {
            const recordDate = record.date;
            if (startDateValue && recordDate < startDateValue) return false;
            if (endDateValue && recordDate > endDateValue) return false;
            return true;
        });
        
        if (startDateValue && endDateValue) {
            dateRangeText = `${formatDate(startDateValue)} 至 ${formatDate(endDateValue)}`;
        } else if (startDateValue) {
            dateRangeText = `${formatDate(startDateValue)} 至今`;
        } else if (endDateValue) {
            dateRangeText = `首次记录 至 ${formatDate(endDateValue)}`;
        }
    } else {
        // 默认：从首次记录到当前日期
        const firstDate = sortedRecords[0].date;
        const lastDate = sortedRecords[sortedRecords.length - 1].date;
        dateRangeText = `${formatDate(firstDate)} 至 ${formatDate(lastDate)}`;
    }

    // 获取当前账户总资产
    const stockRecords = sortedRecords.filter(r => r.investmentType === 'stock');
    const fundRecords = sortedRecords.filter(r => r.investmentType === 'fund');
    
    const currentStockAsset = stockRecords.length > 0 ? (stockRecords[stockRecords.length - 1].totalAsset || 0) : 0;
    const currentFundAsset = fundRecords.length > 0 ? (fundRecords[fundRecords.length - 1].totalAsset || 0) : 0;

    document.getElementById('currentStockAsset').textContent = formatCurrency(currentStockAsset);
    document.getElementById('currentFundAsset').textContent = formatCurrency(currentFundAsset);

    // 计算股票和基金的盈亏
    let stockProfitLoss = 0;
    let fundProfitLoss = 0;

    // 按日期范围计算盈亏
    filteredRecords.forEach((record, index) => {
        // 找到前一条记录（在全部记录中，不是过滤后的）
        const recordIndex = sortedRecords.findIndex(r => r.date === record.date);
        const prevRecord = recordIndex > 0 ? sortedRecords[recordIndex - 1] : null;
        
        // 但前一条记录可能不在过滤范围内，需要找到过滤范围内或之前最近的一条
        let actualPrevRecord = null;
        if (recordIndex > 0) {
            // 从当前记录往前找，找到第一条记录或过滤范围内的前一条
            for (let i = recordIndex - 1; i >= 0; i--) {
                const prev = sortedRecords[i];
                if (!startDateValue || prev.date >= startDateValue) {
                    actualPrevRecord = prev;
                    break;
                }
            }
            // 如果没找到，使用全部记录中的前一条（用于计算基准）
            if (!actualPrevRecord && recordIndex > 0) {
                actualPrevRecord = sortedRecords[recordIndex - 1];
            }
        }

        const dailyProfitLoss = calculateDailyProfitLoss(record, actualPrevRecord, adjustments);

        if (record.investmentType === 'stock') {
            stockProfitLoss += dailyProfitLoss;
        } else if (record.investmentType === 'fund') {
            fundProfitLoss += dailyProfitLoss;
        }
    });

    const totalProfitLoss = stockProfitLoss + fundProfitLoss;

    // 显示盈亏统计
    const stockProfitElement = document.getElementById('stockProfitLoss');
    stockProfitElement.textContent = formatCurrency(stockProfitLoss, true);
    stockProfitElement.className = 'stat-value ' + (stockProfitLoss >= 0 ? 'positive' : 'negative');

    const fundProfitElement = document.getElementById('fundProfitLoss');
    fundProfitElement.textContent = formatCurrency(fundProfitLoss, true);
    fundProfitElement.className = 'stat-value ' + (fundProfitLoss >= 0 ? 'positive' : 'negative');

    const totalProfitElement = document.getElementById('totalProfitLoss');
    totalProfitElement.textContent = formatCurrency(totalProfitLoss, true);
    totalProfitElement.className = 'stat-value ' + (totalProfitLoss >= 0 ? 'positive' : 'negative');

    // 更新图表
    updateChart(filteredRecords, sortedRecords, adjustments);

    // 更新历史记录列表
    updateHistoryTable(filteredRecords, sortedRecords, adjustments);
}

// 更新图表
function updateChart(filteredRecords, allRecords, adjustments) {
    const chartPlaceholder = document.getElementById('chartPlaceholder');
    const canvas = document.getElementById('trendChart');
    
    if (filteredRecords.length === 0) {
        canvas.style.display = 'none';
        chartPlaceholder.style.display = 'block';
        return;
    }

    canvas.style.display = 'block';
    chartPlaceholder.style.display = 'none';

    // 准备图表数据
    const labels = [];
    const stockProfitData = [];
    const fundProfitData = [];
    const indexData = [];
    const stockCumulativeProfit = [];
    const fundCumulativeProfit = [];

    // 找到股票和基金的初始资产（用于计算百分比）
    const sortedFiltered = [...filteredRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstStockRecord = sortedFiltered.find(r => r.investmentType === 'stock');
    const firstFundRecord = sortedFiltered.find(r => r.investmentType === 'fund');
    const initialStockAsset = firstStockRecord ? (firstStockRecord.totalAsset || 1) : 1; // 避免除零
    const initialFundAsset = firstFundRecord ? (firstFundRecord.totalAsset || 1) : 1; // 避免除零

    // 找到初始指数（用于计算指数涨跌百分比）
    const firstIndexRecord = sortedFiltered.find(r => r.shanghaiIndex);
    const initialIndex = firstIndexRecord ? (firstIndexRecord.shanghaiIndex || 1) : 1;

    filteredRecords.forEach((record, index) => {
        labels.push(formatDate(record.date));

        if (record.investmentType === 'stock') {
            // 计算股票涨跌百分比：(当前资产 - 初始资产) / 初始资产 * 100
            const currentStockAsset = record.totalAsset || 0;
            const stockPercent = ((currentStockAsset - initialStockAsset) / initialStockAsset) * 100;
            stockCumulativeProfit.push(stockPercent);
            fundCumulativeProfit.push(null);
        } else {
            // 计算基金涨跌百分比：(当前资产 - 初始资产) / 初始资产 * 100
            const currentFundAsset = record.totalAsset || 0;
            const fundPercent = ((currentFundAsset - initialFundAsset) / initialFundAsset) * 100;
            stockCumulativeProfit.push(null);
            fundCumulativeProfit.push(fundPercent);
        }

        // 指数涨跌百分比：(当前指数 - 初始指数) / 初始指数 * 100
        if (record.shanghaiIndex) {
            const indexPercent = ((record.shanghaiIndex - initialIndex) / initialIndex) * 100;
            indexData.push(indexPercent);
        } else {
            indexData.push(null);
        }
    });

    // 销毁旧图表
    if (trendChart) {
        trendChart.destroy();
    }

    // 创建新图表
    const ctx = canvas.getContext('2d');
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '指数趋势',
                    data: indexData,
                    borderColor: 'rgb(150, 150, 150)',
                    backgroundColor: 'rgba(150, 150, 150, 0.1)',
                    yAxisID: 'y',
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: '股票收益',
                    data: stockCumulativeProfit,
                    borderColor: 'rgb(231, 76, 60)',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    yAxisID: 'y',
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: '基金收益',
                    data: fundCumulativeProfit,
                    borderColor: 'rgb(80, 200, 120)',
                    backgroundColor: 'rgba(80, 200, 120, 0.1)',
                    yAxisID: 'y',
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                // 所有数据都显示百分比
                                const percent = context.parsed.y;
                                label += percent.toFixed(2) + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '日期'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '盈亏百分比（%）'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2) + '%';
                        }
                    }
                },
            }
        }
    });
}

// 更新历史记录表格
function updateHistoryTable(filteredRecords, allRecords, adjustments) {
    const tbody = document.getElementById('historyTableBody');
    
    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="text-align: center; padding: 40px;">暂无记录</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    // 按日期倒序显示（最新的在前）
    const sortedFilteredRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedFilteredRecords.forEach((record) => {
        const row = document.createElement('tr');
        
        // 找到前一条记录用于计算当日盈亏
        const recordIndex = allRecords.findIndex(r => r.date === record.date);
        let actualPrevRecord = null;
        
        if (recordIndex > 0) {
            for (let i = recordIndex - 1; i >= 0; i--) {
                const prev = allRecords[i];
                const startDateValue = document.getElementById('startDate').getAttribute('data-date-value');
                if (!startDateValue || prev.date >= startDateValue) {
                    actualPrevRecord = prev;
                    break;
                }
            }
            if (!actualPrevRecord && recordIndex > 0) {
                actualPrevRecord = allRecords[recordIndex - 1];
            }
        }

        const dailyProfitLoss = calculateDailyProfitLoss(record, actualPrevRecord, adjustments);
        const profitClass = dailyProfitLoss >= 0 ? 'profit-positive' : 'profit-negative';

        row.innerHTML = `
            <td>${formatDate(record.date)}</td>
            <td>${record.investmentType === 'stock' ? '股票' : '基金'}</td>
            <td>${formatCurrency(record.totalAsset || 0)}</td>
            <td>${record.totalMarketValue ? formatCurrency(record.totalMarketValue) : '--'}</td>
            <td>${record.shanghaiIndex ? record.shanghaiIndex.toFixed(2) : '--'}</td>
            <td class="${profitClass}">${formatCurrency(dailyProfitLoss, true)}</td>
            <td>${record.notes || '--'}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 格式化货币
function formatCurrency(amount, showSign = false) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '--';
    }
    
    const sign = showSign ? (amount >= 0 ? '+' : '') : '';
    return sign + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
