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

// 初始化星空背景（立即执行）
function initStars() {
    const container = document.getElementById('starsContainer');
    if (!container) return;

    const starCount = 150;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';

        const sizeClass = Math.random() < 0.6 ? 'small' : (Math.random() < 0.8 ? 'medium' : 'large');
        star.classList.add(sizeClass);

        if (Math.random() < 0.1) star.classList.add('cyan');

        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';

        const duration = 2 + Math.random() * 4;
        const opacity = 0.3 + Math.random() * 0.7;
        const delay = Math.random() * 5;

        star.style.setProperty('--duration', duration + 's');
        star.style.setProperty('--opacity', opacity);
        star.style.animationDelay = delay + 's';

        container.appendChild(star);
    }
}

// 主初始化
document.addEventListener('DOMContentLoaded', async () => {
    initStars();
    loadCenters();
    loadRecords();
    await loadIndex();
    if (indexData) {
        buildRegionConstellationMap();
        initSelects();
        renderCenters();
        renderRecords();
    }
});

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

    const matched = indexData.systems.filter(s => s.includes(input));
    if (matched.length === 0) {
        showToast('未找到匹配的星系');
        return;
    }

    const system = matched[0];
    const info = indexData.system_constellation_map[system];

    if (!info) {
        showToast('星系信息未找到');
        return;
    }

    // 隐藏产物选择区域，加载数据时会重新渲染
    document.getElementById('planetProductSelect').style.display = 'none';

    // 加载星系数据（会自动显示定位信息和产物选择）
    await loadSystemData(system, info.region, info.constellation);
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

    // 按行星分组整理数据
    const planetsMap = new Map();

    for (const [material, info] of Object.entries(data.materials)) {
        // 如果选择了具体产物，只显示该产物
        if (product && material !== product) continue;
        // 如果有分类筛选，过滤材料
        if (category && getMaterialCategory(material) !== category) continue;

        for (const record of info.records) {
            if (!planetsMap.has(record.planet)) {
                planetsMap.set(record.planet, []);
            }
            planetsMap.get(record.planet).push({
                material,
                richness: record.richness,
                output: record.output
            });
        }
    }

    // 转换为数组并按最高产量排序
    const planetsArray = Array.from(planetsMap.entries()).map(([planet, materials]) => ({
        planet,
        materials,
        maxOutput: Math.max(...materials.map(m => m.output))
    }));
    planetsArray.sort((a, b) => b.maxOutput - a.maxOutput);

    if (planetsArray.length === 0) {
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>无数据</p></div>';
        return;
    }

    const center = centers[activeCenterIndex];
    const isSameConstellation = center && data.region === center.region && data.constellation === center.constellation;

    resultsList.innerHTML = planetsArray.map(p => {
        const topMaterial = p.materials.reduce((a, b) => b.output > a.output ? b : a);
        const color = getMaterialColor(topMaterial.material);
        const tag = isSameConstellation ? '<span class="tag tag-same-c">同星座</span>' : '';

        return `
            <div class="detail-header" style="border-bottom: 2px solid #00c8ff">
                <span class="back-btn" onclick="queryConstellation()">← 返回</span>
                <span class="material-title" style="color: #00c8ff">${p.planet}</span>
                <span class="constellation-name">${data.constellation}</span>
            </div>
            <div class="detail-list">
                ${p.materials.sort((a, b) => b.output - a.output).map((m, i) => {
                    const c = getMaterialColor(m.material);
                    const samePlanet = center && center.planet &&
                        data.region === center.region && data.constellation === center.constellation &&
                        p.planet === center.planet;
                    const rowClass = samePlanet ? 'same-planet' : '';
                    const tag = samePlanet ? '<span class="tag tag-same-p">同行星</span>' : '';

                    return `
                        <div class="detail-row ${rowClass}">
                            <span class="rank">${i + 1}</span>
                            <span class="planet" style="color: ${c}">${m.material}</span>
                            <span class="richness">${m.richness}</span>
                            <span class="output">${m.output.toFixed(2)}</span>
                            <button class="btn-record" onclick="quickRecordPlanet('${m.material}', '${data.constellation}', '${p.planet}', '${m.richness}', ${m.output})" style="padding:3px 8px;font-size:11px;">记录</button>
                            ${tag}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
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
