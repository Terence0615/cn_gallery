// 引入必要的库
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 加载原始Excel文件
console.log('正在读取原始Excel文件...');
const workbook = XLSX.readFile('各种cn参考.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

// 按control_type分组
console.log('正在对数据进行分组...');
const groupedData = {};
jsonData.forEach(item => {
    const controlType = item.control_type || '未知';
    
    if (!groupedData[controlType]) {
        groupedData[controlType] = [];
    }
    
    groupedData[controlType].push(item);
});

// 限制每组最多600条数据
console.log('正在限制每组数据数量...');
const limitedData = {};
for (const [controlType, items] of Object.entries(groupedData)) {
    limitedData[controlType] = items.slice(0, 600);
    console.log(`${controlType}: 共${items.length}条，取${limitedData[controlType].length}条`);
}

// 保存处理后的数据为JSON文件
console.log('正在保存预处理数据...');
fs.writeFileSync('preprocessed_data.json', JSON.stringify(limitedData, null, 2));

console.log('数据预处理完成！数据已保存到 preprocessed_data.json'); 