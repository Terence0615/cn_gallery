const CONFIG = {
    itemsPerBatch: 20, // 每批加载的项目数
    loadedItems: {} // 存储每个分类已加载的项目数
};

document.addEventListener('DOMContentLoaded', function() {
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const countsDiv = document.getElementById('counts');
    const tabsDiv = document.getElementById('tabs');
    
    // 存储全局数据，供滚动加载使用
    window.appData = null;
    
    // 页面加载后直接加载预处理好的数据
    loadingDiv.style.display = 'block';
    loadPreprocessedData();
    
    // 图片预加载设置
    window.imageCacheMap = new Map(); // 缓存已加载的图片
    
    function loadPreprocessedData() {
        // 显示加载状态
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.style.display = 'block';
        
        fetch('preprocessed_data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('无法加载预处理数据：' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                // 保存数据到全局变量
                window.appData = data;
                
                // 计算各组原始数据量
                const originalCounts = {};
                for (const controlType in data) {
                    originalCounts[controlType] = data[controlType].length;
                    // 初始化已加载数量
                    CONFIG.loadedItems[controlType] = 0;
                }
                
                // 显示统计信息和数据
                displayCounts(originalCounts, data);
                displayResults(data);
                
                // 设置滚动监听和灯箱
                setupScrollListener();
                setupLightbox();
                
                if (loadingDiv) loadingDiv.style.display = 'none';
            })
            .catch(error => {
                console.error('加载预处理数据时出错:', error);
                const resultsDiv = document.getElementById('results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = `
                        <div class="error-message">
                            <p>加载预处理数据时出错: ${error.message}</p>
                            <p>请确保"preprocessed_data.json"文件位于同一目录下，且通过HTTP服务器访问该页面。</p>
                        </div>
                    `;
                }
                if (loadingDiv) loadingDiv.style.display = 'none';
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
            const allItems = groupedData[controlType];
            // 初始只加载一批数据
            const itemsToLoad = Math.min(CONFIG.itemsPerBatch, allItems.length);
            const items = allItems.slice(0, itemsToLoad);
            CONFIG.loadedItems[controlType] = itemsToLoad;
            
            // 创建标签
            tabsHtml += `<div class="tab ${index === 0 ? 'active' : ''}" data-tab="${controlType}">${controlType}</div>`;
            
            // 创建内容
            resultsHtml += `
                <div class="category-section ${index === 0 ? 'active' : ''}" id="${controlType}">
                    <h2>控制类型: ${controlType}</h2>
                    <div class="card-container" id="container-${controlType}">
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
                        ${controlImage ? `<div><strong>控制图像:</strong><br><img class="lazy-load" data-src="${controlImage}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="控制图像" onerror="this.onerror=null; this.src='default_control_image.png';"></div>` : ''}
                        ${resultImage ? `<div><strong>结果图像:</strong><br><img class="lazy-load" data-src="${resultImage}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="结果图像" onerror="this.onerror=null; this.src='default_result_image.png';"></div>` : ''}
                    </div>
                `;
            });
            
            resultsHtml += `
                    </div>
                    <div class="loader" id="loader-${controlType}" style="display: none; text-align: center; padding: 20px;">
                        <div class="loading-spinner"></div>
                        <p>加载更多...</p>
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
                const targetSection = document.getElementById(tab.getAttribute('data-tab'));
                targetSection.classList.add('active');
                
                // 检查是否需要加载更多内容
                checkAndLoadMoreItems(tab.getAttribute('data-tab'));
            });
        });
        
        setupLazyLoading();
    }
    
    // 设置滚动监听
    function setupScrollListener() {
        // 创建观察者，检测加载更多指示器是否可见
        const options = {
            root: null, // 使用视口作为根
            rootMargin: '0px 0px 200px 0px', // 底部预加载区域
            threshold: 0.1 // 10%可见时触发
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 获取当前活动的分类
                    const activeSection = document.querySelector('.category-section.active');
                    if (activeSection) {
                        const controlType = activeSection.id;
                        loadMoreItems(controlType);
                    }
                }
            });
        }, options);
        
        // 监听活动内容区域的滚动
        window.addEventListener('scroll', function() {
            const activeSection = document.querySelector('.category-section.active');
            if (activeSection) {
                checkAndLoadMoreItems(activeSection.id);
            }
        });
        
        // 观察所有加载指示器
        document.querySelectorAll('.loader').forEach(loader => {
            observer.observe(loader);
        });
    }
    
    // 检查并加载更多内容
    function checkAndLoadMoreItems(controlType) {
        if (!window.appData) return;
        
        const allItems = window.appData[controlType];
        const loadedCount = CONFIG.loadedItems[controlType];
        
        // 如果已经加载了所有项目，则不需要加载更多
        if (loadedCount >= allItems.length) {
            document.getElementById(`loader-${controlType}`).style.display = 'none';
            return;
        }
        
        // 检查是否接近底部
        const container = document.getElementById(`container-${controlType}`);
        const loader = document.getElementById(`loader-${controlType}`);
        
        if (container && loader) {
            const containerRect = container.getBoundingClientRect();
            const containerBottom = containerRect.bottom;
            const viewportHeight = window.innerHeight;
            
            // 如果容器底部接近或已经进入视口，加载更多内容
            if (containerBottom - 200 <= viewportHeight) {
                loader.style.display = 'block';
                loadMoreItems(controlType);
            }
        }
    }
    
    // 加载更多内容
    function loadMoreItems(controlType) {
        if (!window.appData) return;
        
        const allItems = window.appData[controlType];
        const loadedCount = CONFIG.loadedItems[controlType];
        const container = document.getElementById(`container-${controlType}`);
        const loader = document.getElementById(`loader-${controlType}`);
        
        // 如果已经加载了所有项目，则不需要加载更多
        if (loadedCount >= allItems.length) {
            if (loader) loader.style.display = 'none';
            return;
        }
        
        // 显示加载指示器
        if (loader) loader.style.display = 'block';
        
        // 模拟加载延迟，避免UI过于突兀
        setTimeout(() => {
            // 确定要加载的项目范围
            const startIndex = loadedCount;
            const endIndex = Math.min(startIndex + CONFIG.itemsPerBatch, allItems.length);
            const newItems = allItems.slice(startIndex, endIndex);
            
            // 创建HTML
            let newItemsHtml = '';
            newItems.forEach(item => {
                const generateId = item.generate_id || '无ID';
                const prompt = item.prompt || '无prompt';
                const controlImage = item.control_image || '';
                const resultImage = item.result_url || '';
                
                newItemsHtml += `
                    <div class="card">
                        <div class="generate-id"><strong>Generate ID:</strong> ${generateId}</div>
                        <div class="prompt-section"><strong>Prompt:</strong> ${prompt}</div>
                        <div class="control-type">控制类型: ${controlType}</div>
                        ${controlImage ? `<div><strong>控制图像:</strong><br><img class="lazy-load" data-src="${controlImage}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="控制图像" onerror="this.onerror=null; this.src='default_control_image.png';"></div>` : ''}
                        ${resultImage ? `<div><strong>结果图像:</strong><br><img class="lazy-load" data-src="${resultImage}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="结果图像" onerror="this.onerror=null; this.src='default_result_image.png';"></div>` : ''}
                    </div>
                `;
            });
            
            // 添加到容器
            if (container) {
                container.insertAdjacentHTML('beforeend', newItemsHtml);
            }
            
            // 更新加载计数
            CONFIG.loadedItems[controlType] = endIndex;
            
            // 隐藏加载指示器（如果所有项目都已加载）
            if (endIndex >= allItems.length && loader) {
                loader.style.display = 'none';
            }
            
            // 对新加载的图片应用懒加载
            setupLazyLoading();
            
        }, 300); // 300毫秒的加载延迟
    }
    
    // 处理图片点击事件的函数
    function setupLightbox() {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const closeLightbox = document.querySelector('.close-lightbox');
        
        if (!lightbox || !lightboxImg || !closeLightbox) {
            console.error('灯箱元素未找到');
            return;
        }
        
        // 使用事件委托处理图片点击
        document.getElementById('results').addEventListener('click', function(e) {
            if (e.target.tagName === 'IMG' && e.target.closest('.card')) {
                // 显示加载中的提示
                lightbox.classList.add('loading');
                lightboxImg.style.opacity = '0.3';
                lightbox.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                
                const imgSrc = e.target.dataset.src || e.target.src;
                
                // 检查是否已缓存
                if (window.imageCacheMap.has(imgSrc)) {
                    lightboxImg.src = window.imageCacheMap.get(imgSrc);
                    lightboxImg.style.opacity = '1';
                    lightbox.classList.remove('loading');
                } else {
                    // 创建新图像对象来预加载
                    const img = new Image();
                    img.onload = function() {
                        window.imageCacheMap.set(imgSrc, imgSrc);
                        lightboxImg.src = imgSrc;
                        lightboxImg.style.opacity = '1';
                        lightbox.classList.remove('loading');
                    };
                    img.onerror = function() {
                        lightboxImg.src = 'default_image.png';
                        lightboxImg.style.opacity = '1';
                        lightbox.classList.remove('loading');
                    };
                    img.src = imgSrc;
                }
            }
        });
        
        // 关闭灯箱事件
        closeLightbox.onclick = function() {
            lightbox.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
        
        lightbox.onclick = function(e) {
            if (e.target === lightbox) {
                lightbox.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        };
    }

    // 添加ESC键关闭灯箱
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const lightbox = document.getElementById('lightbox');
            if (lightbox && lightbox.style.display === 'flex') {
                lightbox.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        }
    });

    // 使用Intersection Observer改进懒加载机制
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-load');
                        observer.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img.lazy-load').forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // 回退到传统懒加载
            document.querySelectorAll('img.lazy-load').forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }
}); 