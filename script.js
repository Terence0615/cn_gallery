document.addEventListener('DOMContentLoaded', function() {
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const countsDiv = document.getElementById('counts');
    const tabsDiv = document.getElementById('tabs');
    
    // 页面加载后直接加载预处理好的数据
    loadingDiv.style.display = 'block';
    loadPreprocessedData();
    
    function loadPreprocessedData() {
        // 使用fetch API获取预处理好的JSON数据
        fetch('preprocessed_data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('无法加载预处理数据：' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                // 计算各组原始数据量
                const originalCounts = {};
                for (const controlType in data) {
                    originalCounts[controlType] = data[controlType].length;
                }
                
                // 显示统计信息
                displayCounts(originalCounts, data);
                
                // 显示数据
                displayResults(data);
                
                loadingDiv.style.display = 'none';
            })
            .catch(error => {
                console.error('加载预处理数据时出错:', error);
                resultsDiv.innerHTML = `
                    <div class="error-message">
                        <p>加载预处理数据时出错: ${error.message}</p>
                        <p>请确保"preprocessed_data.json"文件位于同一目录下，且通过HTTP服务器访问该页面。</p>
                    </div>
                `;
                loadingDiv.style.display = 'none';
            });
    }
    
    function loadExcelFile() {
        // 保留原有的Excel文件加载功能作为备选
        fetch('各种cn参考.xlsx')
            .then(response => {
                if (!response.ok) {
                    throw new Error('无法加载文件：' + response.statusText);
                }
                return response.arrayBuffer();
            })
            .then(data => {
                processExcel(new Uint8Array(data));
            })
            .catch(error => {
                console.error('加载Excel文件时出错:', error);
                resultsDiv.innerHTML = `
                    <div class="error-message">
                        <p>加载文件时出错: ${error.message}</p>
                        <p>请确保"各种cn参考.xlsx"或"preprocessed_data.json"文件位于同一目录下，且通过HTTP服务器访问该页面。</p>
                    </div>
                `;
                loadingDiv.style.display = 'none';
            });
    }
    
    function processExcel(data) {
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 将Excel数据转换为JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // 按control_type分组
            const groupedData = groupByControlType(jsonData);
            
            // 限制每组最多600条数据
            const limitedData = limitDataPerGroup(groupedData, 600);
            
            // 显示统计信息
            displayCounts(groupedData, limitedData);
            
            // 显示数据
            displayResults(limitedData);
            
            loadingDiv.style.display = 'none';
        } catch (error) {
            console.error('处理Excel文件时出错:', error);
            resultsDiv.innerHTML = `<p>处理文件时出错: ${error.message}</p>`;
            loadingDiv.style.display = 'none';
        }
    }
    
    function groupByControlType(data) {
        const grouped = {};
        
        data.forEach(item => {
            const controlType = item.control_type || '未知';
            
            if (!grouped[controlType]) {
                grouped[controlType] = [];
            }
            
            grouped[controlType].push(item);
        });
        
        return grouped;
    }
    
    function limitDataPerGroup(groupedData, limit) {
        const limited = {};
        
        for (const [controlType, items] of Object.entries(groupedData)) {
            limited[controlType] = items.slice(0, limit);
        }
        
        return limited;
    }
    
    function displayCounts(original, limited) {
        let countsHtml = '<h3>数据统计</h3><ul>';
        
        for (const controlType of Object.keys(limited).sort()) {
            const originalCount = original[controlType] || limited[controlType].length;
            const limitedCount = limited[controlType].length;
            
            countsHtml += `<li><span class="control-type">${controlType}</span>: 共${originalCount}条数据，显示${limitedCount}条</li>`;
        }
        
        countsHtml += '</ul>';
        countsDiv.innerHTML = countsHtml;
    }
    
    function displayResults(groupedData) {
        let tabsHtml = '';
        let resultsHtml = '';
        
        // 按字母顺序排序control_type
        const sortedControlTypes = Object.keys(groupedData).sort();
        
        sortedControlTypes.forEach((controlType, index) => {
            const items = groupedData[controlType];
            
            // 创建标签
            tabsHtml += `<div class="tab ${index === 0 ? 'active' : ''}" data-tab="${controlType}">${controlType}</div>`;
            
            // 创建内容
            resultsHtml += `
                <div class="category-section ${index === 0 ? 'active' : ''}" id="${controlType}">
                    <h2>控制类型: ${controlType}</h2>
                    <div class="card-container">
            `;
            
            items.forEach(item => {
                const generateId = item.generate_id || '无ID';
                const prompt = item.prompt || '无prompt';
                const controlImage = item.control_image || '';
                const resultImage = item.result_url || '';
                
                resultsHtml += `
                    <div class="card">
                        <div class="generate-id"><strong>Generate ID:</strong> ${generateId}</div>
                        <div class="prompt-section"><strong>Prompt:</strong> ${prompt}</div>
                        <div class="control-type">控制类型: ${controlType}</div>
                        ${controlImage ? `<div><strong>控制图像:</strong><br><img src="${controlImage}" alt="控制图像" loading="lazy" onerror="this.onerror=null; this.src='default_control_image.png';"></div>` : ''}
                        ${resultImage ? `<div><strong>结果图像:</strong><br><img src="${resultImage}" alt="结果图像" loading="lazy" onerror="this.onerror=null; this.src='default_result_image.png';"></div>` : ''}
                    </div>
                `;
            });
            
            resultsHtml += `
                    </div>
                </div>
            `;
        });
        
        tabsDiv.innerHTML = tabsHtml;
        resultsDiv.innerHTML = resultsHtml;
        
        // 添加标签页切换功能
        const tabs = document.querySelectorAll('.tab');
        const sections = document.querySelectorAll('.category-section');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
            });
        });
    }
}); 