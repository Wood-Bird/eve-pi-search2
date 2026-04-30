// EVE 行星材料查询 - 主逻辑

// 全局变量
let indexData = null;
let constellationCache = {};
let regionConstellations = {};
let centers = [];
let activeCenterIndex = 0;
let selectedPlanetInfo = null;
let records = [];
let currentRecordType = 'material';
let selectedRecordMaterial = null;
let selectedRecordSystem = null;
let currentSystemData = null; // 当前定位星系的数据

// 星系连接分析器
let galaxyAnalyzer = null;
let currentSearchMode = 'standard'; // 'standard' 或 'connection'
let extraSystemConstellation = {}; // 额外的星系-星座映射

// 星系连接分析工具类
class GalaxyConnectionAnalyzer {
    constructor() {
        this.systemIdToName = new Map();  // 星系ID -> 英文星系名称
        this.systemNameToId = new Map();  // 英文星系名称 -> 星系ID
        this.connections = new Map();     // 邻接表: systemId -> Set(connectedSystemIds)
        this.isLoaded = false;
        this.chineseToEnglish = new Map(); // 中文名称 -> 英文名称
        this.englishToChinese = new Map(); // 英文名称 -> 中文名称
    }

    // 加载星系数据
    async loadSolarSystems() {
        try {
            console.log('开始加载星系数据...');
            const response = await fetch('资源文件/EVESovMap/mapSolarSystems.csv');
            if (!response.ok) {
                console.error(`加载星系数据失败: HTTP ${response.status}`);
                return;
            }
            let csvContent = await response.text();
            
            // 移除可能的BOM头
            if (csvContent.charCodeAt(0) === 0xFEFF) {
                csvContent = csvContent.slice(1);
            }
            
            const lines = csvContent.split('\n').filter(line => line.trim());
            if (lines.length === 0) {
                console.error('星系数据文件为空');
                return;
            }
            
            const headers = lines[0].split(',');
            console.log(`星系数据列头: ${headers.slice(0, 5)}...`);
            
            let loadedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                const systemIdIndex = headers.indexOf('solarSystemID');
                const systemNameIndex = headers.indexOf('solarSystemName');
                if (systemIdIndex >= 0 && systemNameIndex >= 0) {
                    const systemId = parseInt(values[systemIdIndex]);
                    const systemName = values[systemNameIndex];
                    if (!isNaN(systemId) && systemName) {
                        this.systemIdToName.set(systemId, systemName);
                        this.systemNameToId.set(systemName, systemId);
                        loadedCount++;
                    }
                }
            }
            console.log(`✅ 已加载 ${loadedCount} 个星系`);
        } catch (error) {
            console.error('加载星系数据失败:', error.message);
        }
    }

    // 加载星系连接数据
    async loadConnections() {
        try {
            console.log('开始加载星系连接数据...');
            const response = await fetch('资源文件/EVESovMap/mapSolarSystemJumps.csv');
            if (!response.ok) {
                console.error(`加载星系连接数据失败: HTTP ${response.status}`);
                return;
            }
            let csvContent = await response.text();
            
            // 移除可能的BOM头
            if (csvContent.charCodeAt(0) === 0xFEFF) {
                csvContent = csvContent.slice(1);
            }
            
            const lines = csvContent.split('\n').filter(line => line.trim());
            if (lines.length === 0) {
                console.error('星系连接数据文件为空');
                return;
            }
            
            const headers = lines[0].split(',');
            console.log(`连接数据列头: ${headers.slice(0, 5)}...`);
            
            let loadedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                const fromIndex = headers.indexOf('fromSolarSystemID');
                const toIndex = headers.indexOf('toSolarSystemID');
                if (fromIndex >= 0 && toIndex >= 0) {
                    const fromId = parseInt(values[fromIndex]);
                    const toId = parseInt(values[toIndex]);
                    
                    if (!isNaN(fromId) && !isNaN(toId)) {
                        if (!this.connections.has(fromId)) {
                            this.connections.set(fromId, new Set());
                        }
                        this.connections.get(fromId).add(toId);
                        
                        if (!this.connections.has(toId)) {
                            this.connections.set(toId, new Set());
                        }
                        this.connections.get(toId).add(fromId);
                        loadedCount++;
                    }
                }
            }
            console.log(`✅ 已加载 ${loadedCount} 条连接关系`);
            this.isLoaded = true;
        } catch (error) {
            console.error('加载星系连接数据失败:', error.message);
        }
    }

    // 加载中英文名称映射
    async loadNameMapping() {
        try {
            console.log('开始加载星系名称映射...');
            const response = await fetch('data/system_names.json');
            if (!response.ok) {
                console.warn('加载星系名称映射失败: HTTP', response.status);
                return;
            }
            const data = await response.json();
            if (data.mapping) {
                for (const [english, info] of Object.entries(data.mapping)) {
                    // 使用第一个中文名称作为主要显示名称
                    if (info.cn && info.cn.length > 0) {
                        this.englishToChinese.set(english, info.cn[0]);
                    } else {
                        this.englishToChinese.set(english, english);
                    }
                    
                    // 建立中文名称到英文的映射
                    if (info.cn) {
                        for (const cnName of info.cn) {
                            this.chineseToEnglish.set(cnName, english);
                        }
                    }
                    
                    // 建立拼音到英文的映射（支持拼音搜索）
                    if (info.py) {
                        for (const pyName of info.py) {
                            this.chineseToEnglish.set(pyName.toLowerCase(), english);
                        }
                    }
                }
            }
            console.log(`✅ 已加载 ${this.chineseToEnglish.size} 个星系名称映射（含拼音）`);
        } catch (error) {
            console.warn('加载星系名称映射失败:', error.message);
        }
    }

    // 初始化加载所有数据
    async init() {
        await this.loadSolarSystems();
        await this.loadConnections();
        await this.loadNameMapping();
    }

    // 将名称转换为英文（用于查询）
    toEnglish(name) {
        if (!name) return name;
        
        const trimmed = name.trim();
        
        // 先尝试精确匹配
        const exactMatch = this.chineseToEnglish.get(trimmed);
        if (exactMatch) return exactMatch;
        
        // 尝试大小写不敏感匹配
        const lowerName = trimmed.toLowerCase();
        const lowerMatch = this.chineseToEnglish.get(lowerName);
        if (lowerMatch) return lowerMatch;
        
        // 尝试模糊匹配（支持拼音部分匹配）
        for (const [key, value] of this.chineseToEnglish) {
            if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
                return value;
            }
        }
        
        // 返回原名称（可能已经是英文）
        return trimmed;
    }

    // 将名称转换为中文（用于显示）
    toChinese(name) {
        return this.englishToChinese.get(name) || name;
    }

    // 解析CSV行（处理带引号的字段）
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    // 获取指定跳数范围内的所有星系（BFS）
    getSystemsWithinJumps(startName, maxJumps) {
        // 首先将输入名称转换为英文（支持中文、拼音）
        const englishName = this.toEnglish(startName);
        
        // 尝试查找星系ID
        const startId = this.systemNameToId.get(englishName);
        
        if (!startId) return { success: false, error: `未找到星系: ${startName}` };
        
        const visited = new Map();
        const queue = [{ id: startId, distance: 0 }];
        // 使用中文名称显示（如果有映射）
        const displayStartName = this.toChinese(englishName) || englishName;
        const results = [{ name: displayStartName, englishName: englishName, distance: 0 }];
        visited.set(startId, 0);
        
        while (queue.length > 0) {
            const { id, distance } = queue.shift();
            
            if (distance >= maxJumps) continue;
            
            const neighbors = this.connections.get(id) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor) || visited.get(neighbor) > distance + 1) {
                    visited.set(neighbor, distance + 1);
                    queue.push({ id: neighbor, distance: distance + 1 });
                    const enName = this.systemIdToName.get(neighbor);
                    if (enName) {
                        // 使用中文名称显示（如果有映射）
                        const chineseName = this.toChinese(enName) || enName;
                        // 避免重复添加
                        if (!results.some(r => r.englishName === enName)) {
                            results.push({ name: chineseName, englishName: enName, distance: distance + 1 });
                        }
                    }
                }
            }
        }
        
        return { success: true, systems: results.sort((a, b) => a.distance - b.distance) };
    }

    // 获取星系的所有邻居
    getNeighbors(systemName) {
        const systemId = this.systemNameToId.get(systemName);
        if (!systemId) return null;
        
        const neighbors = this.connections.get(systemId) || new Set();
        return Array.from(neighbors).map(id => this.systemIdToName.get(id)).filter(Boolean);
    }
}

// 初始化星空背景
function initStars() {
    const container = document.getElementById('starsContainer');
    if (!container) return;

    const starCount = 120;
    const colorClasses = ['cyan', 'cyan', 'cyan', 'green', 'green', 'amber', 'red', 'purple'];

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';

        const sizeClass = Math.random() < 0.55 ? 'small' : (Math.random() < 0.75 ? 'medium' : 'large');
        star.classList.add(sizeClass);

        if (Math.random() < 0.12) {
            star.classList.add(colorClasses[Math.floor(Math.random() * colorClasses.length)]);
        }

        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';

        const duration = 3 + Math.random() * 5;
        const opacity = 0.3 + Math.random() * 0.7;
        const delay = Math.random() * 5;

        star.style.setProperty('--duration', duration + 's');
        star.style.setProperty('--opacity', opacity);
        star.style.animationDelay = delay + 's';

        container.appendChild(star);
    }

    // 探针扫描声纳
    initScanPing();
}

// 探针扫描声纳效果
function initScanPing() {
    const container = document.getElementById('scanPingContainer');
    if (!container) return;

    const pingCount = 3;
    for (let i = 0; i < pingCount; i++) {
        const ping = document.createElement('div');
        ping.className = 'scan-ping';
        ping.style.left = (20 + Math.random() * 60) + '%';
        ping.style.top = (20 + Math.random() * 60) + '%';
        ping.style.setProperty('--ping-dur', (5 + Math.random() * 3) + 's');
        ping.style.setProperty('--ping-delay', (i * 2) + 's');
        container.appendChild(ping);
    }
}

// 主初始化
document.addEventListener('DOMContentLoaded', async () => {
    loadCenters();
    loadRecords();
    await loadIndex();
    if (indexData) {
        buildRegionConstellationMap();
        initSelects();
        renderCenters();
        renderRecords();
    }
    
    // 初始化星系连接分析器（异步加载，不阻塞主流程）
    galaxyAnalyzer = new GalaxyConnectionAnalyzer();
    galaxyAnalyzer.init().then(() => {
        console.log('星系连接分析器初始化完成');
    }).catch(err => {
        console.error('星系连接分析器初始化失败:', err);
    });
    
    // 初始化搜索模式切换事件
    initSearchModeSwitch();
    
    // 数据加载完成后再初始化背景动画，避免阻塞
    // (星星和波纹效果已移除)
    // 延迟启动背景视频，避免与数据加载争抢带宽
    setTimeout(() => {
        const v = document.getElementById('bgVideo');
        if (v) {
            v.playbackRate = 0.5;
            v.play().catch(() => {});
        }
    }, 1500);
});

// 初始化搜索模式切换
function initSearchModeSwitch() {
    const modeStandard = document.getElementById('modeStandard');
    const modeConnection = document.getElementById('modeConnection');
    const sliderContainer = document.getElementById('connectionRangeSlider');
    const jumpRange = document.getElementById('jumpRange');
    const sliderValue = document.querySelector('.slider-value');
    
    // 标准模式点击
    modeStandard?.addEventListener('click', () => {
        currentSearchMode = 'standard';
        modeStandard.classList.add('active');
        modeConnection.classList.remove('active');
        sliderContainer.style.display = 'none';
    });
    
    // 连接模式点击
    modeConnection?.addEventListener('click', () => {
        currentSearchMode = 'connection';
        modeConnection.classList.add('active');
        modeStandard.classList.remove('active');
        sliderContainer.style.display = 'block';
    });
    
    // 滑块值变化
    jumpRange?.addEventListener('input', (e) => {
        sliderValue.textContent = e.target.value;
    });
}

// 材料分类
const materialCategories = {
    '金属': ['基础金属', '重金属', '贵金属', '有毒金属', '反应金属'],
    '复合物': ['晶体复合物', '透光复合物', '黑暗复合物', '杂色复合物', '多样复合物', '光滑复合物', '纤维复合物'],
    '合金': ['光泽合金', '闪光合金', '光彩合金', '精密合金', '浓缩合金'],
    '气体': ['稀有气体', '活性气体'],
    '燃料': ['同位素燃料', '液化臭氧', '重水', '凝缩液', '冷却剂', '离子溶液', '悬浮等离子', '等离子体团'],
    '建筑材料': ['建筑模块', '灵巧单元建筑模块', '硅结构铸材', '工业纤维', '超张力塑料', '聚芳酰胺'],
};

// 反向映射：材料名 -> 分类名
const materialToCategory = {};
for (const [cat, mats] of Object.entries(materialCategories)) {
    for (const m of mats) materialToCategory[m] = cat;
}

function getMaterialCategory(m) { return materialToCategory[m] || '其他'; }

// 材料颜色
const materialColors = {
    '稀有气体': '#9b59b6', '活性气体': '#9b59b6', '离子溶液': '#9b59b6', '悬浮等离子': '#9b59b6', '等离子体团': '#9b59b6',
    '有毒金属': '#f39c12', '重金属': '#f39c12', '基础金属': '#f39c12', '贵金属': '#f39c12', '反应金属': '#f39c12',
    '硅结构铸材': '#95a5a6', '光泽合金': '#95a5a6', '闪光合金': '#95a5a6', '光彩合金': '#95a5a6', '精密合金': '#95a5a6', '浓缩合金': '#95a5a6',
    '晶体复合物': '#27ae60', '透光复合物': '#27ae60', '黑暗复合物': '#27ae60', '杂色复合物': '#27ae60', '多样复合物': '#27ae60', '光滑复合物': '#27ae60', '纤维复合物': '#27ae60',
    '工业纤维': '#3498db', '建筑模块': '#3498db', '灵巧单元建筑模块': '#3498db',
    '凝缩液': '#00d4aa', '冷却剂': '#00d4aa', '重水': '#00d4aa', '液化臭氧': '#00d4aa',
    '同位素燃料': '#e74c3c',
    '纳米体': '#f39c12', '超张力塑料': '#f39c12', '聚芳酰胺': '#7f8c8d'
};

function getMaterialColor(m) { return materialColors[m] || '#7f8c8d'; }

// 加载索引
async function loadIndex() {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '<div class="loading">正在初始化...</div>';

    try {
        const response = await fetch('data/index.json');
        if (!response.ok) throw new Error('加载失败');
        indexData = await response.json();
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">🪐</div><p>选择星座或搜索星系查看材料产出</p></div>';
        console.log('索引加载完成，星系数量:', indexData.systems?.length || 0);
        
        // 加载额外的星系-星座映射
        try {
            const extraResponse = await fetch('data/extra_system_constellation.json');
            if (extraResponse.ok) {
                extraSystemConstellation = await extraResponse.json();
                console.log('额外星系-星座映射加载完成，数量:', Object.keys(extraSystemConstellation).length);
            }
        } catch (e) {
            console.warn('加载额外星系-星座映射失败:', e);
        }
    } catch (e) {
        console.error('索引加载失败:', e);
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>初始化失败</p></div>';
    }
}

// 构建星域 - 星座映射
function buildRegionConstellationMap() {
    regionConstellations = {};
    for (const [c, r] of Object.entries(indexData.constellation_region_map)) {
        if (!regionConstellations[r]) regionConstellations[r] = [];
        regionConstellations[r].push(c);
    }
}

// 初始化选择器
function initSelects() {
    const regionSelect = document.getElementById('regionSelect');
    regionSelect.innerHTML = '<option value="">选择星域</option>';
    indexData.regions.forEach(r => regionSelect.innerHTML += `<option value="${r}">${r}</option>`);
    regionSelect.onchange = () => updateConstellationSelect('constellationSelect', regionSelect.value);

    const centerRegionSelect = document.getElementById('centerRegionSelect');
    centerRegionSelect.innerHTML = '<option value="">选择星域</option>';
    indexData.regions.forEach(r => centerRegionSelect.innerHTML += `<option value="${r}">${r}</option>`);
    centerRegionSelect.onchange = () => updateConstellationSelect('centerConstellationSelect', centerRegionSelect.value);

    // 初始化分类选择器
    const categorySelect = document.getElementById('categorySelect');
    categorySelect.innerHTML = '<option value="">全部分类</option>';
    for (const cat of Object.keys(materialCategories)) {
        categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    }
    categorySelect.onchange = () => updateProductSelect('categorySelect');

    // 初始化产物下拉框（默认空）
    const productSelect = document.getElementById('productSelect');
    productSelect.innerHTML = '<option value="">全部产物</option>';
}

// 根据选择的分类更新产物下拉框
function updateProductSelect() {
    const categorySelect = document.getElementById('categorySelect');
    const productSelect = document.getElementById('productSelect');
    const category = categorySelect.value;

    productSelect.innerHTML = '<option value="">全部产物</option>';

    if (category && materialCategories[category]) {
        materialCategories[category].forEach(prod => {
            productSelect.innerHTML += `<option value="${prod}">${prod}</option>`;
        });
    }
}

// 更新星座选择
function updateConstellationSelect(targetId, region) {
    const select = document.getElementById(targetId);
    select.innerHTML = '<option value="">选择星座</option>';
    if (region && regionConstellations[region]) {
        regionConstellations[region].forEach(c => select.innerHTML += `<option value="${c}">${c}</option>`);
    }
}

// 切换搜索标签
function switchTab(tab) {
    document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('constellationTab').style.display = tab === 'constellation' ? 'block' : 'none';
    document.getElementById('planetTab').style.display = tab === 'planet' ? 'block' : 'none';

    hideAllDropdowns();
}

// 切换工业中心添加模式
function switchCenterMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('planetMode').style.display = mode === 'planet' ? 'block' : 'none';
    document.getElementById('selectMode').style.display = mode === 'select' ? 'block' : 'none';

    hideAllDropdowns();
}

// 隐藏所有下拉框
function hideAllDropdowns() {
    document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('show'));
}

// ========== 星系搜索功能 ==========

// 主搜索页 - 星系搜索输入
function onPlanetSearchInput() {
    const input = document.getElementById('planetSearchInput').value.trim();
    const dropdown = document.getElementById('planetDropdown');

    if (!input) {
        dropdown.classList.remove('show');
        return;
    }

    const matched = indexData.systems.filter(s => s.includes(input)).slice(0, 20);

    if (matched.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item"><span class="main">未找到匹配星系</span></div>';
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = matched.map(sys => {
        const info = indexData.system_constellation_map[sys];
        const planets = indexData.system_planets[sys] || [];
        return `
            <div class="dropdown-item" onclick="selectSystem('${sys}', 'planetSearchInput', 'planetDropdown')">
                <span class="main">${sys}</span>
                <span class="sub">${info?.region || ''} › ${info?.constellation || ''} (${planets.length}个行星)</span>
            </div>
        `;
    }).join('');
    dropdown.classList.add('show');
}

// 工业中心弹窗 - 星系搜索输入
function onCenterPlanetSearch() {
    const input = document.getElementById('centerPlanetSearch').value.trim();
    const dropdown = document.getElementById('centerPlanetDropdown');

    if (!input) {
        dropdown.classList.remove('show');
        return;
    }

    const matched = indexData.systems.filter(s => s.includes(input)).slice(0, 20);

    if (matched.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item"><span class="main">未找到匹配星系</span></div>';
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = matched.map(sys => {
        const info = indexData.system_constellation_map[sys];
        const planets = indexData.system_planets[sys] || [];
        return `
            <div class="dropdown-item" onclick="selectSystemForCenter('${sys}')">
                <span class="main">${sys}</span>
                <span class="sub">${info?.region || ''} › ${info?.constellation || ''} (${planets.length}个行星)</span>
            </div>
        `;
    }).join('');
    dropdown.classList.add('show');
}

// 选择星系（主搜索）
function selectSystem(sys, inputId, dropdownId) {
    document.getElementById(inputId).value = sys;
    document.getElementById(dropdownId).classList.remove('show');
    searchByPlanet();
}

// 选择星系（工业中心弹窗）
function selectSystemForCenter(sys) {
    const info = indexData.system_constellation_map[sys];
    if (info) {
        selectedPlanetInfo = {
            system: sys,
            region: info.region,
            constellation: info.constellation,
            planets: indexData.system_planets[sys] || []
        };

        document.getElementById('centerPlanetSearch').value = sys;
        document.getElementById('centerPlanetDropdown').classList.remove('show');

        document.getElementById('selectedPlanetInfo').style.display = 'block';
        document.getElementById('selectedPlanetDisplay').innerHTML =
            `<span style="color:#ffaa00">${info.region}</span> › <span style="color:#00aaff">${info.constellation}</span> › <span style="color:#00ff00">${sys}</span>`;
    }
}

// 按星系搜索
async function searchByPlanet() {
    const input = document.getElementById('planetSearchInput').value.trim();
    if (!input) {
        showToast('请输入星系名称');
        return;
    }

    console.log(`[搜索] 用户输入: "${input}"`);
    console.log(`[搜索] 当前模式: ${currentSearchMode}`);
    
    // 获取所有可用的星系名称（合并多个数据源确保完整性）
    let allSystemNames = new Set();
    
    // 从 indexData.systems 获取
    if (indexData && indexData.systems) {
        indexData.systems.forEach(s => allSystemNames.add(s));
        console.log(`[搜索] 从索引数据获取到 ${indexData.systems.length} 个星系`);
    }
    
    // 从 galaxyAnalyzer 获取
    if (galaxyAnalyzer && galaxyAnalyzer.isLoaded) {
        galaxyAnalyzer.systemNameToId.forEach((id, name) => allSystemNames.add(name));
        console.log(`[搜索] 从星系分析器添加后共 ${allSystemNames.size} 个星系`);
    }
    
    // 先尝试直接匹配
    let matched = Array.from(allSystemNames).filter(s => s.toLowerCase().includes(input.toLowerCase()));
    console.log(`[搜索] 直接匹配结果: ${matched.length} 个`);
    
    // 如果没有找到，尝试使用名称映射转换（支持中文和拼音）
    if (matched.length === 0 && galaxyAnalyzer && galaxyAnalyzer.isLoaded) {
        console.log(`[搜索] 尝试中文转英文...`);
        const englishName = galaxyAnalyzer.toEnglish(input);
        console.log(`[搜索] 中文转英文结果: "${englishName}"`);
        if (englishName && englishName !== input) {
            matched = Array.from(allSystemNames).filter(s => s.toLowerCase().includes(englishName.toLowerCase()));
            console.log(`[搜索] 转换后匹配结果: ${matched.length} 个`);
        }
    }
    
    // 如果还是没有找到，尝试模糊匹配
    if (matched.length === 0) {
        showToast('未找到匹配的星系');
        return;
    }

    const system = matched[0];
    console.log(`[搜索] 选中星系: "${system}"`);
    
    // 先从主映射中查找星座信息
    let info = indexData.system_constellation_map[system];
    
    // 如果没找到，从额外映射中查找
    if (!info) {
        info = extraSystemConstellation[system];
    }
    
    console.log(`[搜索] 星系信息:`, info);

    // 隐藏产物选择区域
    document.getElementById('planetProductSelect').style.display = 'none';

    // 根据搜索模式执行不同的搜索
    if (currentSearchMode === 'connection') {
        // 星系连接搜索模式 - 不需要星座信息，直接搜索
        await searchByConnection(system, info?.region || '', info?.constellation || '');
    } else {
        // 标准模式：按星域搜索 - 需要星座信息
        if (!info) {
            showToast('星系信息未找到');
            return;
        }
        await loadSystemData(system, info.region, info.constellation);
    }
}

// 按星系连接搜索
async function searchByConnection(system, region, constellation) {
    const resultsList = document.getElementById('resultsList');
    
    // 检查星系分析器是否已加载
    if (!galaxyAnalyzer || !galaxyAnalyzer.isLoaded) {
        resultsList.innerHTML = `<div class="empty-state"><div class="icon">⏳</div><p>星系连接数据加载中，请稍候...</p></div>`;
        return;
    }

    // 获取滑块值
    const maxJumps = parseInt(document.getElementById('jumpRange').value);
    if (isNaN(maxJumps)) maxJumps = 1;
    
    // 获取中文显示名称
    const displaySystemName = galaxyAnalyzer.toChinese(system) || system;
    
    resultsList.innerHTML = `<div class="loading">正在搜索 ${displaySystemName} 周边 ${maxJumps} 跳范围内的星系...</div>`;

    try {
        // 使用星系连接分析器获取范围内的星系
        console.log(`[连接搜索] 开始搜索星系: "${system}", 最大跳数: ${maxJumps}`);
        const result = galaxyAnalyzer.getSystemsWithinJumps(system, maxJumps);
        console.log(`[连接搜索] 搜索结果:`, result);
        
        if (!result.success) {
            console.error('[连接搜索] 星系搜索失败:', result.error);
            resultsList.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${result.error}</p></div>`;
            return;
        }

        const systems = result.systems;
        console.log(`[连接搜索] 找到 ${systems.length} 个星系:`, systems.map(s => s.name));

        // 收集所有星系的数据
        const allPlanetsData = [];
        const processedConstellations = new Set();
        const notFoundSystems = [];

        for (const sysInfo of systems) {
            // 使用英文名称查找星座信息
            const sysEnglishName = sysInfo.englishName || sysInfo.name;
            
            // 先从主映射中查找
            let sysConstellationInfo = indexData.system_constellation_map[sysEnglishName];
            
            // 如果没找到，从额外映射中查找
            if (!sysConstellationInfo) {
                sysConstellationInfo = extraSystemConstellation[sysEnglishName];
            }
            
            console.log(`[连接搜索] 处理星系: "${sysInfo.name}" (英文: "${sysEnglishName}"), 星座信息:`, sysConstellationInfo);
            
            if (!sysConstellationInfo) {
                notFoundSystems.push(sysInfo.name);
                console.log(`[连接搜索] 星系 "${sysInfo.name}" 未找到星座信息，跳过`);
                continue;
            }
            
            const sysConstellation = sysConstellationInfo.constellation;
            
            // 避免重复加载相同星座的数据
            if (processedConstellations.has(sysConstellation)) continue;
            processedConstellations.add(sysConstellation);

            try {
                const filename = 'data/constellation_' + sysConstellation.replace(/[/ ]/g, '_') + '.json';
                const response = await fetch(filename);
                if (response.ok) {
                    const data = await response.json();
                    
                    // 收集该星座中匹配星系的行星数据
                    // 支持两种数据格式：
                    // 1. 新格式: data.planets = { "Jita I": { system: "Jita", materials: {...} } }
                    // 2. 原有格式: data.materials = { "稀有气体": { records: [{planet: "Jita I", richness: "富裕", output: 30.66}] } }
                    
                    if (data.planets) {
                        // 新格式
                        for (const [planetName, planetData] of Object.entries(data.planets)) {
                            if (planetData.system === sysEnglishName || planetData.system === sysInfo.name) {
                                allPlanetsData.push({
                                    system: sysInfo.name,
                                    distance: sysInfo.distance,
                                    constellation: sysConstellation,
                                    region: sysConstellationInfo.region,
                                    planet: planetName,
                                    ...planetData
                                });
                            }
                        }
                    } else if (data.materials) {
                        // 原有格式：按 materials 组织
                        for (const [materialName, materialData] of Object.entries(data.materials)) {
                            if (materialData.records && Array.isArray(materialData.records)) {
                                for (const record of materialData.records) {
                                    // 行星名称格式可能是 "0-3VW8 三" 或 "Jita I"
                                    // 需要检查行星名称是否以星系名开头
                                    const planetName = record.planet;
                                    if (planetName && (planetName.startsWith(sysEnglishName + ' ') || planetName.startsWith(sysInfo.name + ' '))) {
                                        // 检查是否已添加过（避免重复）
                                        if (!allPlanetsData.some(p => p.planet === planetName && p.system === sysInfo.name)) {
                                            allPlanetsData.push({
                                                system: sysInfo.name,
                                                distance: sysInfo.distance,
                                                constellation: sysConstellation,
                                                region: sysConstellationInfo.region,
                                                planet: planetName,
                                                richness: record.richness,
                                                output: record.output,
                                                material: materialName,
                                                materials: { [materialName]: record.output }
                                            });
                                        } else {
                                            // 已存在，更新 materials
                                            const existing = allPlanetsData.find(p => p.planet === planetName && p.system === sysInfo.name);
                                            if (existing && existing.materials) {
                                                existing.materials[materialName] = record.output;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`加载星座 ${sysConstellation} 数据失败:`, e);
            }
        }

        // 按距离排序
        allPlanetsData.sort((a, b) => a.distance - b.distance);

        // 渲染结果
        if (allPlanetsData.length === 0) {
            resultsList.innerHTML = `<div class="empty-state"><div class="icon">🪐</div><p>未找到 ${system} 周边 ${maxJumps} 跳范围内的行星数据</p></div>`;
            return;
        }

        // 收集所有可用产物
        const allMaterials = new Set();
        for (const planet of allPlanetsData) {
            if (planet.materials) {
                Object.keys(planet.materials).forEach(mat => allMaterials.add(mat));
            }
        }
        const materialsArray = Array.from(allMaterials).sort();

        // 保存当前搜索数据供查询使用（同时保存英文和中文名称）
        window.currentConnectionSearchData = {
            system: system,
            displaySystemName: displaySystemName,
            maxJumps: maxJumps,
            planetsData: allPlanetsData
        };

        // 显示搜索范围信息和产物选择
        document.getElementById('planetProductSelect').style.display = 'block';

        // 保存当前产物选择，重新搜索后恢复
        const previousProduct = document.getElementById('planetProductDropdown')?.value || '';

        document.getElementById('planetProductSelect').innerHTML = `
            <div style="margin-top: 10px; padding: 12px; background: rgba(0,200,255,0.08); border-radius: 8px; margin-bottom: 10px;">
                <div style="color: #888; font-size: 12px; margin-bottom: 6px;">搜索范围：</div>
                <div style="font-size: 13px;">
                    <span style="color:#00ff88">● 中心星系: ${displaySystemName}</span>
                    <span style="color:#888; margin: 0 8px">|</span>
                    <span style="color:#ffaa00">搜索半径: ${maxJumps} 跳</span>
                    <span style="color:#888; margin: 0 8px">|</span>
                    <span style="color:#00aaff">找到 ${allPlanetsData.length} 个行星</span>
                </div>
            </div>
            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">选择要查询的产物：</div>
            <div class="search-row">
                <select id="planetProductDropdown"><option value="">选择产物</option></select>
                <button class="btn-search" onclick="queryConnectionProduct()">查询</button>
            </div>
        `;

        // 填充产物下拉框选项
        const productDropdown = document.getElementById('planetProductDropdown');
        productDropdown.innerHTML = '<option value="">选择产物</option>' +
            materialsArray.map(m => `<option value="${m}">${m}</option>`).join('');

        // 恢复之前的产物选择（如果新列表中有该产物）
        if (previousProduct && materialsArray.includes(previousProduct)) {
            productDropdown.value = previousProduct;
        }

        // 显示提示信息
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">🪐</div><p>请选择要查询的产物</p></div>';
        
    } catch (error) {
        console.error('星系连接搜索失败:', error);
        resultsList.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>搜索失败: ${error.message}</p></div>`;
    }
}

// 渲染行星结果列表
function renderPlanetResults(planetsData) {
    const resultsList = document.getElementById('resultsList');

    let html = '';
    let currentSystem = null;

    for (const planet of planetsData) {
        // 按星系分组显示（只有当行星名称不包含星系名时才显示分组标题）
        const planetStartsWithSystem = planet.planet && planet.system &&
            planet.planet.toLowerCase().startsWith(planet.system.toLowerCase());

        if (!planetStartsWithSystem && planet.system !== currentSystem) {
            currentSystem = planet.system;
            const distanceLabel = planet.distance === 0 ? '(中心星系)' : `(${planet.distance} 跳)`;
            html += `
                <div style="margin-top: 15px; margin-bottom: 8px;">
                    <span style="color: #00c8ff; font-weight: bold; font-size: 13px;">${planet.system}</span>
                    <span style="color: #888; font-size: 11px; margin-left: 8px;">${distanceLabel}</span>
                </div>
            `;
        }

        // 支持两种数据格式：type/richness 和 output/materials
        const displayType = planet.type || planet.richness || '';
        const displayOutput = planet.output || '';

        html += `
            <div class="result-item" style="margin-left: 15px;">
                <div class="result-header">
                    <span class="result-name">${planet.planet}</span>
                    ${displayType ? `<span class="result-type">${displayType}</span>` : ''}
                    ${displayOutput ? `<span class="result-type" style="color: #ffaa00;">产量: ${displayOutput}</span>` : ''}
                </div>
                <div class="result-materials">
                    ${planet.materials ? Object.entries(planet.materials).map(([mat, qty]) =>
                        `<span class="material-tag">${mat}: ${qty}</span>`
                    ).join('') : ''}
                </div>
            </div>
        `;
    }
    
    resultsList.innerHTML = html;
}

// 加载星系数据
async function loadSystemData(system, region, constellation) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `<div class="loading">正在加载 ${system} 数据...</div>`;

    try {
        const filename = 'data/constellation_' + constellation.replace(/[/ ]/g, '_') + '.json';
        const response = await fetch(filename);
        if (!response.ok) throw new Error('文件不存在');
        const data = await response.json();

        currentSystemData = {
            system: system,
            region: region,
            constellation: constellation,
            data: data
        };

        const materials = Object.keys(data.materials).sort();

        // 先渲染星系概览信息和产物选择界面
        document.getElementById('planetProductSelect').innerHTML = `
            <div style="margin-top: 10px; padding: 12px; background: rgba(0,200,255,0.08); border-radius: 8px; margin-bottom: 10px;">
                <div style="color: #888; font-size: 12px; margin-bottom: 6px;">星系信息：</div>
                <div style="font-size: 13px;">
                    <span style="color:#ffaa00">● ${region}</span>
                    <span style="color:#888; margin: 0 8px">›</span>
                    <span style="color:#00aaff">${constellation}</span>
                    <span style="color:#888; margin: 0 8px">›</span>
                    <span style="color:#00ff00">${system}</span>
                </div>
                <div style="color: #888; font-size: 11px; margin-top: 6px;">该星系共有 ${materials.length} 种可开采产物</div>
            </div>
            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">选择要查询的产物：</div>
            <div class="search-row">
                <select id="planetProductDropdown"><option value="">选择产物</option></select>
                <button class="btn-search" onclick="queryProduct()">查询</button>
            </div>
        `;

        // 然后填充产物下拉框选项
        const productDropdown = document.getElementById('planetProductDropdown');
        productDropdown.innerHTML = '<option value="">选择产物</option>' +
            materials.map(m => `<option value="${m}">${m}</option>`).join('');

        document.getElementById('planetProductSelect').style.display = 'block';
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">🪐</div><p>请选择要查询的产物</p></div>';
    } catch (e) {
        console.error('加载失败:', e);
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>数据加载失败</p></div>';
    }
}

// 查询产物 - 只显示指定产物在整个星座内的详细信息
function queryProduct() {
    const material = document.getElementById('planetProductDropdown').value;
    if (!material) {
        showToast('请选择产物');
        return;
    }
    if (!currentSystemData) {
        showToast('请先定位星系');
        return;
    }

    const data = currentSystemData.data;
    const system = currentSystemData.system;
    const constellation = currentSystemData.constellation;
    const region = currentSystemData.region;
    const materialInfo = data.materials[material];

    if (!materialInfo) {
        showToast('该产物在此星座不存在');
        return;
    }

    // 获取整个星座的所有记录（过滤掉没有产出的）
    const allRecords = materialInfo.records.filter(r => {
        const systemName = r.planet.split(' ')[0];
        const planetInfo = indexData.system_constellation_map[systemName];
        return planetInfo && planetInfo.constellation === constellation;
    });

    if (allRecords.length === 0) {
        document.getElementById('resultsList').innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>该星座没有此产物</p></div>';
        return;
    }

    allRecords.sort((a, b) => b.output - a.output);
    const topRecord = allRecords[0];

    const center = centers[activeCenterIndex];
    const isSameConstellation = center && data.region === center.region && data.constellation === center.constellation;
    const color = getMaterialColor(material);

    // 直接显示该产物的星球详情列表（没有中间的汇总卡片）
    document.getElementById('resultsList').innerHTML = `
        <div class="detail-header" style="border-bottom: 2px solid ${color};">
            <span class="back-btn" onclick="hidePlanetProductSelect()">← 返回</span>
            <span class="material-title" style="color: ${color}">${material}</span>
            <span class="constellation-name">${constellation} (${region})</span>
        </div>
        <div class="detail-list">
            ${allRecords.map((r, i) => {
                const samePlanet = center && center.planet &&
                    data.region === center.region && data.constellation === center.constellation &&
                    r.planet === center.planet;
                const rowClass = samePlanet ? 'same-planet' : '';
                const tag = samePlanet ? '<span class="tag tag-same-p">同行星</span>' : '';

                return `
                    <div class="detail-row ${rowClass}">
                        <span class="rank">${i + 1}</span>
                        <span class="planet">${r.planet}</span>
                        <span class="richness">${r.richness}</span>
                        <span class="output">${r.output.toFixed(2)}</span>
                        <button class="btn-record" onclick="quickRecordPlanet('${material}', '${data.constellation}', '${r.planet}', '${r.richness}', ${r.output})" style="padding:3px 8px;font-size:11px;">记录</button>
                        ${tag}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 查询星系连接搜索模式下的产物
function queryConnectionProduct() {
    const material = document.getElementById('planetProductDropdown').value;
    if (!material) {
        showToast('请选择产物');
        return;
    }
    if (!window.currentConnectionSearchData) {
        showToast('请先进行星系连接搜索');
        return;
    }

    const searchData = window.currentConnectionSearchData;
    const system = searchData.system;
    const displaySystemName = searchData.displaySystemName || system;
    const maxJumps = searchData.maxJumps;
    const allPlanets = searchData.planetsData;

    // 过滤出包含该产物的行星
    const matchingPlanets = allPlanets.filter(planet => {
        return planet.materials && planet.materials[material];
    });

    if (matchingPlanets.length === 0) {
        document.getElementById('resultsList').innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>在 ${displaySystemName} 周边 ${maxJumps} 跳范围内未找到产出 "${material}" 的行星</p></div>`;
        return;
    }

    // 按距离和产出排序
    matchingPlanets.sort((a, b) => {
        // 先按距离排序
        if (a.distance !== b.distance) {
            return a.distance - b.distance;
        }
        // 距离相同时按产出降序排序
        const outputA = a.materials[material] || 0;
        const outputB = b.materials[material] || 0;
        return outputB - outputA;
    });

    const color = getMaterialColor(material);

    // 渲染结果
    document.getElementById('resultsList').innerHTML = `
        <div class="detail-header" style="border-bottom: 2px solid ${color};">
            <span class="back-btn" onclick="hidePlanetProductSelect()">← 返回</span>
            <span class="material-title" style="color: ${color}">${material}</span>
            <span class="constellation-name">${displaySystemName} 周边 ${maxJumps} 跳</span>
        </div>
        <div class="detail-list">
            ${matchingPlanets.map((planet, i) => {
                const output = planet.materials[material] || 0;
                const richness = planet.type || planet.richness || '';
                const planetStartsWithSystem = planet.planet && planet.system &&
                    planet.planet.toLowerCase().startsWith(planet.system.toLowerCase());
                const displayPlanetName = planetStartsWithSystem ? planet.planet : `${planet.system} ${planet.planet}`;
                return `
                    <div class="detail-row">
                        <span class="rank">${i + 1}</span>
                        <span class="planet">${displayPlanetName}</span>
                        <span class="richness">${richness}</span>
                        <span class="output">${output.toFixed(2)}</span>
                        <button class="btn-record" onclick="quickRecordPlanet('${material}', '${planet.constellation}', '${planet.planet}', '${richness}', ${output})" style="padding:3px 8px;font-size:11px;">记录</button>
                        <span class="tag tag-distance">${planet.distance} 跳</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 隐藏产物选择界面
function hidePlanetProductSelect() {
    document.getElementById('planetProductSelect').style.display = 'none';
    document.getElementById('planetSearchInput').focus();
}

// 显示产物详情
function showProductDetails(material, constellation, system) {
    const data = currentSystemData.data;
    const materialInfo = data.materials[material];
    const color = getMaterialColor(material);
    const center = centers[activeCenterIndex];

    const systemRecords = materialInfo.records.filter(r => r.planet.startsWith(system + ' '));
    systemRecords.sort((a, b) => b.output - a.output);

    document.getElementById('resultCount').textContent = `${material} 在 ${system} 共 ${systemRecords.length} 个采集点`;

    document.getElementById('resultsList').innerHTML = `
        <div class="detail-header" style="border-bottom: 2px solid ${color}">
            <span class="back-btn" onclick="queryProduct()">← 返回</span>
            <span class="material-title" style="color: ${color}">${material}</span>
            <span class="constellation-name">${constellation} › ${system}</span>
        </div>
        <div class="detail-list">
            ${systemRecords.map((r, i) => {
                const samePlanet = center && center.planet &&
                    data.region === center.region && constellation === center.constellation &&
                    r.planet === center.planet;
                const rowClass = samePlanet ? 'same-planet' : '';
                const tag = samePlanet ? '<span class="tag tag-same-p">同行星</span>' : '';

                return `
                    <div class="detail-row ${rowClass}">
                        <span class="rank">${i + 1}</span>
                        <span class="planet">${r.planet}</span>
                        <span class="richness">${r.richness}</span>
                        <span class="output">${r.output.toFixed(2)}</span>
                        <button class="btn-record" onclick="quickRecordPlanet('${material}', '${constellation}', '${r.planet}', '${r.richness}', ${r.output})" style="padding:3px 8px;font-size:11px;">记录</button>
                        ${tag}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ========== 星座查询 ==========

async function queryConstellation() {
    const constellation = document.getElementById('constellationSelect').value;
    const category = document.getElementById('categorySelect').value;
    const product = document.getElementById('productSelect').value;

    if (!constellation) {
        showToast('请选择星座');
        return;
    }

    // 如果选择了具体产物，忽略分类筛选
    const data = await loadConstellationData(constellation);
    if (data) showPlanetsInConstellation(data, category || null, product || null);
}

async function loadConstellationData(constellation) {
    if (constellationCache[constellation]) return constellationCache[constellation];

    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `<div class="loading">正在加载 ${constellation}...</div>`;

    try {
        const filename = 'data/constellation_' + constellation.replace(/[/ ]/g, '_') + '.json';
        const response = await fetch(filename);
        if (!response.ok) throw new Error('文件不存在');
        const data = await response.json();
        constellationCache[constellation] = data;
        return data;
    } catch (e) {
        console.error('加载失败:', e);
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>数据加载失败</p></div>';
        return null;
    }
}

// 显示星座中的星球列表 - 直接显示星球详情，不显示汇总卡片
function showPlanetsInConstellation(data, category = null, product = null) {
    const resultsList = document.getElementById('resultsList');

    // 收集所有记录
    const allRecords = [];

    for (const [material, info] of Object.entries(data.materials)) {
        // 如果选择了具体产物，只显示该产物
        if (product && material !== product) continue;
        // 如果有分类筛选，过滤材料
        if (category && getMaterialCategory(material) !== category) continue;

        for (const record of info.records) {
            allRecords.push({
                ...record,
                material
            });
        }
    }

    if (allRecords.length === 0) {
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>无数据</p></div>';
        return;
    }

    // 按产量排序
    allRecords.sort((a, b) => b.output - a.output);

    const center = centers[activeCenterIndex];
    const isSameConstellation = center && data.region === center.region && data.constellation === center.constellation;
    
    // 如果指定了产物，使用产物的颜色；否则使用默认颜色
    const material = product || allRecords[0].material;
    const color = getMaterialColor(material);

    // 直接显示该产物的星球详情列表（与按星系搜索格式一致）
    resultsList.innerHTML = `
        <div class="detail-header" style="border-bottom: 2px solid ${color};">
            <span class="back-btn" onclick="queryConstellation()">← 返回</span>
            <span class="material-title" style="color: ${color}">${product || '所有产物'}</span>
            <span class="constellation-name">${data.constellation} (${data.region})</span>
        </div>
        <div class="detail-list">
            ${allRecords.map((r, i) => {
                const samePlanet = center && center.planet &&
                    data.region === center.region && data.constellation === center.constellation &&
                    r.planet === center.planet;
                const rowClass = samePlanet ? 'same-planet' : '';
                const tag = samePlanet ? '<span class="tag tag-same-p">同行星</span>' : '';
                const materialColor = getMaterialColor(r.material);

                return `
                    <div class="detail-row ${rowClass}">
                        <span class="rank">${i + 1}</span>
                        <span class="planet">${r.planet}</span>
                        <span class="richness">${r.richness}</span>
                        <span class="output">${r.output.toFixed(2)}</span>
                        <button class="btn-record" onclick="quickRecordPlanet('${r.material}', '${data.constellation}', '${r.planet}', '${r.richness}', ${r.output})" style="padding:3px 8px;font-size:11px;">记录</button>
                        ${tag}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 显示星球详情
function showPlanetDetails(constellation, planetDataStr) {
    const planetData = JSON.parse(decodeURIComponent(planetDataStr));
    const data = constellationCache[constellation];
    const center = centers[activeCenterIndex];

    document.getElementById('resultCount').textContent = `${planetData.planet} 共 ${planetData.materials.length} 种产物`;

    resultsList.innerHTML = `
        <div class="detail-header" style="border-bottom: 2px solid #00c8ff">
            <span class="back-btn" onclick="queryConstellation()">← 返回</span>
            <span class="material-title" style="color: #00c8ff">${planetData.planet}</span>
            <span class="constellation-name">${constellation}</span>
        </div>
        <div class="detail-list">
            ${planetData.materials.sort((a, b) => b.output - a.output).map((m, i) => {
                const color = getMaterialColor(m.material);
                const samePlanet = center && center.planet &&
                    data.region === center.region && constellation === center.constellation &&
                    planetData.planet === center.planet;
                const rowClass = samePlanet ? 'same-planet' : '';
                const tag = samePlanet ? '<span class="tag tag-same-p">同行星</span>' : '';

                return `
                    <div class="detail-row ${rowClass}">
                        <span class="rank">${i + 1}</span>
                        <span class="planet" style="color: ${color}">${m.material}</span>
                        <span class="richness">${m.richness}</span>
                        <span class="output">${m.output.toFixed(2)}</span>
                        <button class="btn-record" onclick="quickRecordPlanet('${m.material}', '${constellation}', '${planetData.planet}', '${m.richness}', ${m.output})" style="padding:3px 8px;font-size:11px;">记录</button>
                        ${tag}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function selectConstellation(constellation, region) {
    document.getElementById('regionSelect').value = region;
    updateConstellationSelect('constellationSelect', region);
    document.getElementById('constellationSelect').value = constellation;
    queryConstellation();
}

// 显示结果
function showResults(data, filterMaterial = null) {
    const resultsList = document.getElementById('resultsList');
    const resultCount = document.getElementById('resultCount');

    let materials = Object.keys(data.materials);
    if (filterMaterial) materials = materials.filter(m => m === filterMaterial);

    materials.sort((a, b) => (data.materials[b]?.max_output || 0) - (data.materials[a]?.max_output || 0));

    resultCount.textContent = `该星座产出 ${materials.length} 种材料`;

    if (materials.length === 0) {
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>无匹配材料</p></div>';
        return;
    }

    const center = centers[activeCenterIndex];
    const isSameConstellation = center && data.region === center.region && data.constellation === center.constellation;

    resultsList.innerHTML = materials.map(material => {
        const info = data.materials[material];
        const color = getMaterialColor(material);
        const best = info.records[0];
        const tag = isSameConstellation ? '<span class="tag tag-same-c">同星座</span>' : '';

        return `
            <div class="material-card" style="border-left: 3px solid ${color}">
                <div class="material-header">
                    <span class="material-name" style="color: ${color}">${material}</span>
                    ${tag}
                </div>
                <div class="material-stats">
                    <div class="stat"><span class="stat-label">最高产量</span><span class="stat-value output">${info.max_output.toFixed(2)}</span></div>
                    <div class="stat"><span class="stat-label">采集点</span><span class="stat-value">${info.count}</span></div>
                </div>
                <div class="best-location">
                    <span class="planet">${best.planet}</span>
                    <span class="richness">${best.richness}</span>
                    <span class="output">${best.output.toFixed(2)}</span>
                </div>
                <div class="material-actions">
                    <button onclick="showDetails('${material}', '${data.constellation}')">查看详情</button>
                    <button class="btn-record" onclick="quickRecordMaterial('${material}', '${data.constellation}')">记录</button>
                </div>
            </div>
        `;
    }).join('');
}

// 显示详情
function showDetails(material, constellation) {
    const data = constellationCache[constellation];
    if (!data?.materials[material]) return;

    const info = data.materials[material];
    const color = getMaterialColor(material);
    const center = centers[activeCenterIndex];

    document.getElementById('resultCount').textContent = `${material} 在 ${constellation} 共 ${info.records.length} 个采集点`;

    document.getElementById('resultsList').innerHTML = `
        <div class="detail-header" style="border-bottom: 2px solid ${color}">
            <span class="back-btn" onclick="queryConstellation()">← 返回</span>
            <span class="material-title" style="color: ${color}">${material}</span>
            <span class="constellation-name">${constellation}</span>
        </div>
        <div class="detail-list">
            ${info.records.map((r, i) => {
                const samePlanet = center && center.planet &&
                    data.region === center.region && constellation === center.constellation && r.planet === center.planet;
                const rowClass = samePlanet ? 'same-planet' : '';
                const tag = samePlanet ? '<span class="tag tag-same-p">同行星</span>' : '';

                return `
                    <div class="detail-row ${rowClass}">
                        <span class="rank">${i + 1}</span>
                        <span class="planet">${r.planet}</span>
                        <span class="richness">${r.richness}</span>
                        <span class="output">${r.output.toFixed(2)}</span>
                        <button class="btn-record" onclick="quickRecordPlanet('${material}', '${constellation}', '${r.planet}', '${r.richness}', ${r.output})" style="padding:3px 8px;font-size:11px;">记录</button>
                        ${tag}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ========== 工业中心管理 ==========

function showAddCenterModal() {
    document.getElementById('addCenterModal').classList.add('show');
    document.getElementById('centerNameInput').value = '';
    document.getElementById('centerPlanetSearch').value = '';
    document.getElementById('centerPlanetInput').value = '';
    document.getElementById('selectedPlanetInfo').style.display = 'none';
    document.getElementById('centerRegionSelect').value = '';
    document.getElementById('centerConstellationSelect').innerHTML = '<option value="">选择星座</option>';
    selectedPlanetInfo = null;
    hideAllDropdowns();
}

function hideAddCenterModal() {
    document.getElementById('addCenterModal').classList.remove('show');
}

function addCenter() {
    const name = document.getElementById('centerNameInput').value.trim();
    const planetInput = document.getElementById('centerPlanetInput').value.trim();

    let region, constellation;

    if (selectedPlanetInfo) {
        region = selectedPlanetInfo.region;
        constellation = selectedPlanetInfo.constellation;
    } else {
        region = document.getElementById('centerRegionSelect').value;
        constellation = document.getElementById('centerConstellationSelect').value;
    }

    if (!name) { showToast('请输入名称'); return; }
    if (!region || !constellation) { showToast('请定位星系或选择星域和星座'); return; }

    centers.push({ name, region, constellation, planet: planetInput || null });
    activeCenterIndex = centers.length - 1;
    saveCenters();
    renderCenters();
    hideAddCenterModal();
    showToast('添加成功');
}

function deleteCenter(index) {
    centers.splice(index, 1);
    if (activeCenterIndex >= centers.length) activeCenterIndex = Math.max(0, centers.length - 1);
    saveCenters();
    renderCenters();
}

function selectCenter(index) {
    activeCenterIndex = parseInt(index);
    saveCenters();
    renderCenters();
}

function renderCenters() {
    const container = document.getElementById('centerList');
    if (centers.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:10px"><p>暂无开采中心</p></div>';
        return;
    }

    container.innerHTML = centers.map((c, i) => `
        <div class="sidebar-center-item ${i === activeCenterIndex ? 'active' : ''}" onclick="selectCenter(${i})">
            <div class="sidebar-center-name">${c.name}</div>
            <div class="sidebar-center-location">${c.region} › ${c.constellation}</div>
            ${c.planet ? `<div class="sidebar-center-system">${c.planet}</div>` : ''}
            <div class="sidebar-center-actions">
                <button onclick="event.stopPropagation(); deleteCenter(${i})">删除</button>
            </div>
        </div>
    `).join('');
}

function saveCenters() {
    localStorage.setItem('eve_centers', JSON.stringify(centers));
    localStorage.setItem('eve_active_idx', String(activeCenterIndex));
}

function loadCenters() {
    try {
        centers = JSON.parse(localStorage.getItem('eve_centers') || '[]');
        activeCenterIndex = parseInt(localStorage.getItem('eve_active_idx') || '0');
    } catch (e) {
        centers = [];
        activeCenterIndex = 0;
    }
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
}

// 点击其他地方关闭下拉框
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        hideAllDropdowns();
    }
});

// ========== 侧边栏管理 ==========

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const closeBtn = sidebar.querySelector('.sidebar-close');
    sidebar.classList.toggle('open');
    closeBtn.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

// ========== 记录管理 ==========

function showAddRecordModal() {
    document.getElementById('addRecordModal').classList.add('show');
    switchRecordType('material');
    selectedRecordMaterial = null;
    selectedRecordSystem = null;
}

function hideAddRecordModal() {
    document.getElementById('addRecordModal').classList.remove('show');
}

function switchRecordType(type) {
    currentRecordType = type;

    document.querySelectorAll('.record-type-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove('type-material', 'type-system', 'type-planet', 'type-note');
    });
    event.target.classList.add('active');
    event.target.classList.add('type-' + type);

    document.getElementById('recordMaterialFields').style.display = type === 'material' ? 'block' : 'none';
    document.getElementById('recordSystemFields').style.display = type === 'system' ? 'block' : 'none';
    document.getElementById('recordPlanetFields').style.display = type === 'planet' ? 'block' : 'none';
    document.getElementById('recordNoteFields').style.display = type === 'note' ? 'block' : 'none';
}

// ========== 采集记录管理 ==========

function quickRecordMaterial(material, constellation) {
    const data = constellationCache[constellation];
    if (!data) return;

    records.unshift({
        id: Date.now(),
        type: 'material',
        title: material,
        detail: `${data.region} › ${constellation}`,
        note: '',
        createdAt: new Date().toLocaleString('zh-CN')
    });

    saveRecords();
    renderRecords();
    showToast(`已记录 ${material}`);
}

function quickRecordPlanet(material, constellation, planet, richness, output) {
    const parts = planet.split(' ');
    const systemName = parts.slice(0, -1).join(' ');

    records.unshift({
        id: Date.now(),
        type: 'planet',
        title: `${material} @ ${systemName}`,
        detail: `${planet} - ${richness}`,
        note: `产量：${output.toFixed(2)}`,
        createdAt: new Date().toLocaleString('zh-CN')
    });

    saveRecords();
    renderRecords();
    showToast(`已记录 ${material} @ ${systemName}`);
}

function onRecordMaterialSearch() {
    const input = document.getElementById('recordMaterialName').value.trim();
    const dropdown = document.getElementById('recordMaterialDropdown');

    if (!input) {
        dropdown.classList.remove('show');
        selectedRecordMaterial = null;
        return;
    }

    const matched = indexData.materials.filter(m => m.includes(input)).slice(0, 10);

    if (matched.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item"><span class="main">未找到匹配材料</span></div>';
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = matched.map(m => {
        const color = getMaterialColor(m);
        return `
            <div class="dropdown-item" onclick="selectRecordMaterial('${m}')">
                <span class="main" style="color:${color}">${m}</span>
            </div>
        `;
    }).join('');
    dropdown.classList.add('show');
}

function selectRecordMaterial(material) {
    selectedRecordMaterial = material;
    document.getElementById('recordMaterialName').value = material;
    document.getElementById('recordMaterialDropdown').classList.remove('show');
}

function onRecordSystemSearch() {
    const input = document.getElementById('recordSystemName').value.trim();
    const dropdown = document.getElementById('recordSystemDropdown');

    if (!input) {
        dropdown.classList.remove('show');
        selectedRecordSystem = null;
        return;
    }

    const matched = indexData.systems.filter(s => s.includes(input)).slice(0, 10);

    if (matched.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item"><span class="main">未找到匹配星系</span></div>';
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = matched.map(sys => {
        const info = indexData.system_constellation_map[sys];
        return `
            <div class="dropdown-item" onclick="selectRecordSystem('${sys}')">
                <span class="main">${sys}</span>
                <span class="sub">${info?.region || ''} › ${info?.constellation || ''}</span>
            </div>
        `;
    }).join('');
    dropdown.classList.add('show');
}

function selectRecordSystem(system) {
    selectedRecordSystem = system;
    document.getElementById('recordSystemName').value = system;
    document.getElementById('recordSystemDropdown').classList.remove('show');
}

function addRecord() {
    let title = '';
    let detail = '';
    let type = currentRecordType;

    if (type === 'material') {
        const materialName = selectedRecordMaterial || document.getElementById('recordMaterialName').value.trim();
        if (!materialName) { showToast('请输入材料名称'); return; }
        title = materialName;
        detail = '材料采集';
    } else if (type === 'system') {
        const systemName = selectedRecordSystem || document.getElementById('recordSystemName').value.trim();
        if (!systemName) { showToast('请输入星系名称'); return; }
        const info = indexData.system_constellation_map[systemName];
        title = systemName;
        detail = info ? `${info.region} › ${info.constellation}` : '星系';
    } else if (type === 'planet') {
        const planetName = document.getElementById('recordPlanetName').value.trim();
        if (!planetName) { showToast('请输入行星名称'); return; }
        title = planetName;
        detail = '行星采集';
    } else if (type === 'note') {
        const noteTitle = document.getElementById('recordNoteTitle').value.trim();
        if (!noteTitle) { showToast('请输入标题'); return; }
        title = noteTitle;
        detail = '备注';
    }

    const note = document.getElementById('recordNote').value.trim();

    records.unshift({
        id: Date.now(),
        type,
        title,
        detail,
        note,
        createdAt: new Date().toLocaleString('zh-CN')
    });

    saveRecords();
    renderRecords();
    hideAddRecordModal();
    document.getElementById('recordNote').value = '';
    showToast('记录已添加');
}

function deleteRecord(id) {
    records = records.filter(r => r.id !== id);
    saveRecords();
    renderRecords();
}

function saveRecords() {
    localStorage.setItem('eve_records', JSON.stringify(records));
}

function loadRecords() {
    try {
        records = JSON.parse(localStorage.getItem('eve_records') || '[]');
    } catch (e) {
        records = [];
    }
}

function renderRecords() {
    const container = document.getElementById('recordList');
    if (records.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:10px"><p>暂无记录</p></div>';
        return;
    }

    container.innerHTML = records.map(r => {
        const typeClass = 'type-' + r.type;
        return `
            <div class="record-item ${typeClass}">
                <div class="record-title ${typeClass}">${r.title}</div>
                <div class="record-detail">${r.detail}</div>
                ${r.note ? `<div class="record-note">${r.note}</div>` : ''}
                <div class="record-actions">
                    <button onclick="deleteRecord(${r.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}
