// 数据存储键名
const STORAGE_KEY_RECORDS = 'investment_records';
const STORAGE_KEY_ADJUSTMENTS = 'investment_adjustments';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 flatpickr 日期选择器
    const dateInput = document.getElementById('recordDate');
    const flatpickrInstance = flatpickr(dateInput, {
        locale: 'zh',
        dateFormat: 'Y年m月d日',
        defaultDate: new Date(),
        onChange: function(selectedDates, dateStr, instance) {
            // 日期改变时，更新内部存储的日期值（YYYY-MM-DD格式）
            const dateValue = selectedDates[0].toISOString().split('T')[0];
            dateInput.setAttribute('data-date-value', dateValue);
        }
    });
    
    // 设置初始日期值
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('data-date-value', today);

    // 绑定事件
    document.getElementById('saveRecord').addEventListener('click', saveRecord);

    // 投资类型变化
    const investmentTypeRadios = document.querySelectorAll('input[name="investmentType"]');
    investmentTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleInvestmentTypeFields);
    });
    
    // 初始化投资类型字段显示
    toggleInvestmentTypeFields();

    // 加载数据
    loadData();
});


// 切换投资类型字段显示
function toggleInvestmentTypeFields() {
    const investmentType = document.querySelector('input[name="investmentType"]:checked').value;
    const totalMarketValueRow = document.getElementById('totalMarketValueRow');
    
    if (investmentType === 'stock') {
        // 股票：显示总市值输入框
        totalMarketValueRow.style.display = 'block';
    } else {
        // 基金：隐藏总市值输入框
        totalMarketValueRow.style.display = 'none';
        // 清空总市值输入
        document.getElementById('totalMarketValue').value = '';
    }
}

// 获取所有记录
function getRecords() {
    const records = localStorage.getItem(STORAGE_KEY_RECORDS);
    return records ? JSON.parse(records) : [];
}

// 保存记录
function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
}

// 获取所有加减仓记录
function getAdjustments() {
    const adjustments = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
    return adjustments ? JSON.parse(adjustments) : [];
}

// 保存加减仓记录
function saveAdjustments(adjustments) {
    localStorage.setItem(STORAGE_KEY_ADJUSTMENTS, JSON.stringify(adjustments));
}

// 保存账户总额记录
function saveRecord() {
    const totalAsset = parseFloat(document.getElementById('totalAsset').value);
    const dateInput = document.getElementById('recordDate');
    const date = dateInput.getAttribute('data-date-value') || dateInput.value;
    const investmentType = document.querySelector('input[name="investmentType"]:checked').value;
    const totalMarketValue = investmentType === 'stock' ? (parseFloat(document.getElementById('totalMarketValue').value) || null) : null;
    const adjustmentType = document.querySelector('input[name="adjustmentType"]:checked').value;
    let adjustmentAmount = 0;
    if (adjustmentType === 'add') {
        adjustmentAmount = parseFloat(document.getElementById('adjustmentAmountAdd').value) || 0;
    } else if (adjustmentType === 'reduce') {
        adjustmentAmount = parseFloat(document.getElementById('adjustmentAmountReduce').value) || 0;
    }
    const shanghaiIndex = document.getElementById('shanghaiIndex').value ? parseFloat(document.getElementById('shanghaiIndex').value) : null;
    const notes = document.getElementById('notes').value.trim();

    if (!totalAsset || !date) {
        alert('请填写总资产和日期');
        return;
    }

    if (totalAsset <= 0) {
        alert('总资产必须大于0');
        return;
    }

    if (investmentType === 'stock' && (!totalMarketValue || totalMarketValue <= 0)) {
        alert('请填写总市值');
        return;
    }

    if (adjustmentType !== 'none' && (!adjustmentAmount || adjustmentAmount === 0)) {
        alert('请填写加减仓金额');
        return;
    }

    const records = getRecords();
    const adjustments = getAdjustments();
    
    // 检查该日期是否已有记录
    const existingIndex = records.findIndex(r => r.date === date);
    
    const record = {
        date,
        totalAsset,
        totalMarketValue,
        investmentType,
        shanghaiIndex,
        notes: notes || ''
    };

    if (existingIndex >= 0) {
        // 更新现有记录
        records[existingIndex] = record;
    } else {
        // 添加新记录
        records.push(record);
    }

    // 处理加减仓
    if (adjustmentType !== 'none') {
        // 删除该日期已有的加减仓记录
        const filteredAdjustments = adjustments.filter(a => a.date !== date);
        
        const adjustment = {
            id: Date.now(),
            date,
            amount: adjustmentType === 'add' ? adjustmentAmount : -adjustmentAmount,
            notes: notes || ''
        };
        
        filteredAdjustments.push(adjustment);
        filteredAdjustments.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveAdjustments(filteredAdjustments);
    } else {
        // 删除该日期的加减仓记录（如果存在）
        const filteredAdjustments = adjustments.filter(a => a.date !== date);
        saveAdjustments(filteredAdjustments);
    }

    // 按日期排序
    records.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveRecords(records);
    
    // 清空表单
    document.getElementById('totalAsset').value = '';
    document.getElementById('totalMarketValue').value = '';
    document.getElementById('shanghaiIndex').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('adjustmentAmountAdd').value = '';
    document.getElementById('adjustmentAmountReduce').value = '';
    document.querySelector('input[name="adjustmentType"][value="none"]').checked = true;
    
    alert('记录已保存');
}

// 加载数据
function loadData() {
    // 数据已在初始化时加载
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
