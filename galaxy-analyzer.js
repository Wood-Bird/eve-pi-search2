class GalaxyConnectionAnalyzer {
    constructor() {
        this.systemIdToName = new Map();
        this.systemIdToNameZh = new Map();
        this.systemNameToId = new Map();
        this.systemNameZhToId = new Map();
        this.connections = new Map();
        this.isLoaded = false;
        this.chineseToEnglish = new Map();
        this.englishToChinese = new Map();
        this.pinyinToEnglish = new Map();
        this.systemAliases = new Map();
        this.systemInfo = new Map();
        this.constellationIdToName = new Map();
        this.regionIdToName = new Map();
        this.stationSystems = new Set();
        this.bounds = null;
        this.grid = null;
        this.gridCellSize = 0;
    }

    async init() {
        await this.loadConnections();
        await Promise.all([
            this.loadSolarSystems(),
            this.loadChineseMapping(),
            this.loadConstellations(),
            this.loadRegions(),
            this.loadNpcStations()
        ]);
        this.isLoaded = true;
    }

    async loadSolarSystems() {
        try {
            const response = await fetch('资源文件/eve-online-sde-2026-10-07/echoes-map/mapSolarSystems.jsonl');
            if (!response.ok) throw new Error('无法加载星系数据');
            const text = await response.text();
            const lines = text.split('\n').filter(l => l.trim());
            let loadedCount = 0;

            for (const line of lines) {
                try {
                    const o = JSON.parse(line);
                    const systemId = o._key;
                    const pos = o.position;
                    if (!systemId || !pos) continue;

                    const name = o.name?.en || o.name?.zh || '';
                    const nameZh = o.name?.zh || '';
                    const x = pos.x, y = pos.y, z = pos.z;
                    const security = o.securityStatus ?? 0;
                    const regionId = o.regionID;
                    const constellationId = o.constellationID;
                    const securityClass = o.securityClass || '';
                    const p2dx = o.position2D?.x ?? null;
                    const p2dy = o.position2D?.y ?? null;

                    if (!name || !isFinite(x) || !isFinite(y) || !isFinite(z)) continue;

                    this.systemIdToName.set(systemId, name);
                    this.systemNameToId.set(name.toLowerCase(), systemId);
                    if (nameZh && nameZh !== name) {
                        this.systemIdToNameZh.set(systemId, nameZh);
                        this.systemNameZhToId.set(nameZh, systemId);
                    }
                    this.systemInfo.set(systemId, {
                        id: systemId, name, nameZh, x, y, z, security,
                        regionId, constellationId, securityClass, p2dx, p2dy
                    });
                    loadedCount++;
                } catch (_) {}
            }
            console.log(`已加载 ${loadedCount} 个星系（含坐标+中文名）`);
            this._buildSpatialGrid();
        } catch (error) {
            console.error('加载星系数据失败:', error.message);
        }
    }

    _buildSpatialGrid() {
        const xs = [], ys = [], zs = [];
        for (const [, info] of this.systemInfo) {
            xs.push(info.x); ys.push(info.y); zs.push(info.z);
        }
        this.bounds = {
            xMin: Math.min(...xs), xMax: Math.max(...xs),
            yMin: Math.min(...ys), yMax: Math.max(...ys),
            zMin: Math.min(...zs), zMax: Math.max(...zs)
        };
        const cellsPerAxis = 60;
        const xRange = this.bounds.xMax - this.bounds.xMin || 1;
        const yRange = this.bounds.yMax - this.bounds.yMin || 1;
        const zRange = this.bounds.zMax - this.bounds.zMin || 1;
        this.gridCellSize = Math.max(xRange, yRange, zRange) / cellsPerAxis;
        this.xCells = Math.ceil(xRange / this.gridCellSize) + 1;
        this.yCells = Math.ceil(yRange / this.gridCellSize) + 1;
        this.zCells = Math.ceil(zRange / this.gridCellSize) + 1;
        const grid = new Map();
        for (const [id, info] of this.systemInfo) {
            const cx = Math.floor((info.x - this.bounds.xMin) / this.gridCellSize);
            const cy = Math.floor((info.y - this.bounds.yMin) / this.gridCellSize);
            const cz = Math.floor((info.z - this.bounds.zMin) / this.gridCellSize);
            const key = `${cx},${cy},${cz}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(id);
        }
        this.grid = grid;
        console.log(`空间网格构建完成: ${this.grid.size} 个活跃格子`);
    }

    _getNeighborCandidates(centerId, maxDistanceM) {
        const center = this.systemInfo.get(centerId);
        if (!center || !this.grid) return [];
        const cellsRadius = Math.ceil(maxDistanceM / this.gridCellSize) + 1;
        const cx = Math.floor((center.x - this.bounds.xMin) / this.gridCellSize);
        const cy = Math.floor((center.y - this.bounds.yMin) / this.gridCellSize);
        const cz = Math.floor((center.z - this.bounds.zMin) / this.gridCellSize);
        const result = [];
        for (let dx = -cellsRadius; dx <= cellsRadius; dx++) {
            for (let dy = -cellsRadius; dy <= cellsRadius; dy++) {
                for (let dz = -cellsRadius; dz <= cellsRadius; dz++) {
                    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > cellsRadius * 2) continue;
                    const key = `${cx + dx},${cy + dy},${cz + dz}`;
                    const cell = this.grid.get(key);
                    if (cell) {
                        for (const id of cell) result.push(id);
                    }
                }
            }
        }
        return result;
    }

    async loadConnections() {
        try {
            const response = await fetch('资源文件/eve-online-sde-2026-10-07/echoes-map/mapStargates.jsonl');
            if (!response.ok) throw new Error('无法加载星门连接数据');
            const text = await response.text();
            const lines = text.split('\n').filter(l => l.trim());
            let pairCount = 0;
            for (const line of lines) {
                try {
                    const o = JSON.parse(line);
                    const fromId = o.solarSystemID;
                    const toId = o.destination?.solarSystemID;
                    if (!fromId || !toId) continue;
                    if (!this.connections.has(fromId)) this.connections.set(fromId, new Set());
                    if (!this.connections.has(toId)) this.connections.set(toId, new Set());
                    this.connections.get(fromId).add(toId);
                    this.connections.get(toId).add(fromId);
                    pairCount++;
                } catch (_) {}
            }
            console.log(`已加载 ${pairCount} 条星门, 连接 ${this.connections.size} 个星系`);
        } catch (error) {
            console.error('加载连接数据失败:', error.message);
        }
    }

    async loadChineseMapping() {
        try {
            for (const [id, info] of this.systemInfo) {
                if (info.nameZh && info.nameZh !== info.name) {
                    this.chineseToEnglish.set(info.nameZh, info.name);
                    this.englishToChinese.set(info.name, info.nameZh);
                    this.systemAliases.set(info.name.toLowerCase(), new Set([info.name.toLowerCase(), info.nameZh]));
                }
            }
            const response = await fetch('data/system_names.json');
            if (response.ok) {
                const data = await response.json();
                const mapping = data.mapping || {};
                for (const [eng, info] of Object.entries(mapping)) {
                    const engLower = eng.toLowerCase();
                    if (info.cn) {
                        for (const cn of info.cn) {
                            this.chineseToEnglish.set(cn, eng);
                            this.chineseToEnglish.set(cn.trim(), eng);
                        }
                    }
                    if (info.py) {
                        for (const py of info.py) {
                            const pyNorm = py.toLowerCase().replace(/[\s\-]/g, '');
                            this.pinyinToEnglish.set(pyNorm, eng);
                            this.pinyinToEnglish.set(py, eng);
                        }
                    }
                    if (info.cn && info.cn.length > 0) {
                        this.englishToChinese.set(eng, info.cn[0]);
                    }
                    let aliases = this.systemAliases.get(engLower);
                    if (!aliases) { aliases = new Set([engLower]); this.systemAliases.set(engLower, aliases); }
                    if (info.cn) for (const cn of info.cn) aliases.add(cn);
                    if (info.py) for (const py of info.py) aliases.add(py.toLowerCase().replace(/[\s\-]/g, ''));
                }
                console.log(`已加载 ${Object.keys(mapping).length} 个星系的拼音/别名映射`);
            }
            console.log(`当前中文名映射: ${this.chineseToEnglish.size} 条, 拼音映射: ${this.pinyinToEnglish.size} 条`);
        } catch (e) {
            console.warn('加载中文映射失败:', e.message);
        }
    }

    async loadConstellations() {
        try {
            const response = await fetch('资源文件/eve-online-sde-2026-10-07/echoes-map/mapConstellations.jsonl');
            if (!response.ok) return;
            const text = await response.text();
            const lines = text.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    const id = obj._key;
                    if (typeof id === 'number') {
                        const zh = obj.name && obj.name.zh;
                        const en = obj.name && obj.name.en;
                        this.constellationIdToName.set(id, zh || en || '');
                    }
                } catch (_) {}
            }
            console.log(`已加载 ${this.constellationIdToName.size} 个星座中文名称`);
        } catch (e) {
            console.warn('加载星座数据失败:', e.message);
        }
    }

    async loadRegions() {
        try {
            const response = await fetch('资源文件/eve-online-sde-2026-10-07/echoes-map/mapRegions.jsonl');
            if (!response.ok) return;
            const text = await response.text();
            const lines = text.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    const id = obj._key;
                    if (typeof id === 'number') {
                        const zh = obj.name && obj.name.zh;
                        const en = obj.name && obj.name.en;
                        this.regionIdToName.set(id, zh || en || '');
                    }
                } catch (_) {}
            }
            console.log(`已加载 ${this.regionIdToName.size} 个星域中文名称`);
        } catch (e) {
            console.warn('加载星域数据失败:', e.message);
        }
    }

    async loadNpcStations() {
        try {
            const response = await fetch('资源文件/eve-online-sde-2026-10-07/echoes-map/npc_stations.csv');
            if (!response.ok) return;
            const text = await response.text();
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const header = lines[0].split(',');
            const idx = header.indexOf('system_id');
            if (idx < 0) return;
            const seen = new Set();
            let cnt = 0;
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length <= idx) continue;
                const sid = parseInt(parts[idx]);
                if (isNaN(sid) || seen.has(sid)) continue;
                seen.add(sid);
                this.stationSystems.add(sid);
                cnt++;
            }
            console.log(`已加载 ${cnt} 个有 NPC 空间站的星系`);
        } catch (e) {
            console.warn('加载空间站数据失败:', e.message);
        }
    }

    getConstellationName(systemId) {
        const info = this.systemInfo.get(systemId);
        if (!info) return '';
        return this.constellationIdToName.get(info.constellationId) || '';
    }

    getRegionName(systemId) {
        const info = this.systemInfo.get(systemId);
        if (!info) return '';
        return this.regionIdToName.get(info.regionId) || '';
    }

    _pinyinSegments(query) {
        const q = query.toLowerCase().replace(/[\s\-]/g, '');
        for (const [py, eng] of this.pinyinToEnglish) {
            if (py.includes(q) || q.includes(py)) return eng;
        }
        return null;
    }

    searchSystems(query, limit = 20) {
        if (!query) return [];
        const q = query.trim();
        const qLower = q.toLowerCase();
        const results = new Map();

        const add = (id, score) => {
            if (!results.has(id) || results.get(id).score < score) {
                const info = this.systemInfo.get(id);
                results.set(id, {
                    id,
                    name: info.name,
                    chineseName: info.nameZh || this.toChinese(info.name),
                    security: info.security,
                    score
                });
            }
        };

        if (this.systemNameToId.has(qLower)) {
            add(this.systemNameToId.get(qLower), 100);
        }

        const pinyinHit = this._pinyinSegments(qLower);
        if (pinyinHit && this.systemNameToId.has(pinyinHit.toLowerCase())) {
            add(this.systemNameToId.get(pinyinHit.toLowerCase()), 90);
        }

        if (this.chineseToEnglish.has(q)) {
            const eng = this.chineseToEnglish.get(q);
            if (this.systemNameToId.has(eng.toLowerCase())) {
                add(this.systemNameToId.get(eng.toLowerCase()), 95);
            }
        }

        for (const [name, id] of this.systemNameToId) {
            if (name.includes(qLower) || qLower.includes(name)) {
                add(id, 60);
            }
        }

        for (const [cn, eng] of this.chineseToEnglish) {
            if (cn.includes(q) || q.includes(cn)) {
                if (this.systemNameToId.has(eng.toLowerCase())) {
                    add(this.systemNameToId.get(eng.toLowerCase()), 70);
                }
            }
        }

        const qNorm = qLower.replace(/[\s\-]/g, '');
        for (const [py, eng] of this.pinyinToEnglish) {
            if ((py.includes(qNorm) || qNorm.includes(py)) && py.length >= 2) {
                if (this.systemNameToId.has(eng.toLowerCase())) {
                    add(this.systemNameToId.get(eng.toLowerCase()), 75);
                }
            }
        }

        return Array.from(results.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    toEnglish(input) {
        if (!input) return input;
        if (this.chineseToEnglish.has(input)) return this.chineseToEnglish.get(input);
        const q = input.toLowerCase().replace(/[\s\-]/g, '');
        if (this.pinyinToEnglish.has(q)) return this.pinyinToEnglish.get(q);
        return input;
    }

    toChinese(input) {
        if (!input) return input;
        if (this.englishToChinese.has(input)) return this.englishToChinese.get(input);
        return input;
    }

    getSystemInfo(identifier) {
        let id = identifier;
        if (typeof identifier === 'string') {
            const lower = identifier.toLowerCase();
            if (this.systemNameToId.has(lower)) {
                id = this.systemNameToId.get(lower);
            } else if (this.chineseToEnglish.has(identifier)) {
                const eng = this.chineseToEnglish.get(identifier);
                id = this.systemNameToId.get(eng.toLowerCase());
            } else {
                const q = lower.replace(/[\s\-]/g, '');
                if (this.pinyinToEnglish.has(q)) {
                    const eng = this.pinyinToEnglish.get(q);
                    id = this.systemNameToId.get(eng.toLowerCase());
                } else {
                    for (const [eng, chn] of this.englishToChinese) {
                        if (chn === identifier) { id = this.systemNameToId.get(eng.toLowerCase()); break; }
                    }
                }
            }
        }
        return this.systemInfo.get(id) || null;
    }

    calcDistanceLy(id1, id2) {
        const LY_TO_M = 9.4607e15;
        const info1 = this.systemInfo.get(id1);
        const info2 = this.systemInfo.get(id2);
        if (!info1 || !info2) return Infinity;
        const dx = info1.x - info2.x;
        const dy = info1.y - info2.y;
        const dz = info1.z - info2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) / LY_TO_M;
    }

    findIndirectJumpPath(startName, endName, maxLy, waypoints = [], avoidSystems = []) {
        const startInfo = this.getSystemInfo(startName);
        const endInfo = this.getSystemInfo(endName);
        if (!startInfo || !endInfo) {
            return { success: false, error: '找不到起点或终点星系' };
        }

        const avoidIds = new Set();
        for (const name of avoidSystems) {
            const info = this.getSystemInfo(name);
            if (info) avoidIds.add(info.id);
        }

        const waypointIds = [];
        for (const name of waypoints) {
            const info = this.getSystemInfo(name);
            if (info) waypointIds.push(info.id);
        }

        const fullPath = [startInfo.id, ...waypointIds, endInfo.id];
        const segments = [];
        let totalLy = 0;

        for (let i = 0; i < fullPath.length - 1; i++) {
            const segStart = fullPath[i];
            const segEnd = fullPath[i + 1];
            if (avoidIds.has(segStart) || avoidIds.has(segEnd)) {
                return { success: false, error: '起点或终点在规避列表中' };
            }
            const result = this._dijkstraIndirect(segStart, segEnd, maxLy, avoidIds);
            if (!result.success) {
                return { success: false, error: `无法在 ${maxLy} ly 范围内找到可行路径` };
            }
            segments.push(result.path);
            totalLy += result.totalLy;
        }

        const mergedPath = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            for (let j = 0; j < seg.length; j++) {
                if (i > 0 && j === 0) continue;
                mergedPath.push(seg[j]);
            }
        }

        return { success: true, path: mergedPath, totalLy: totalLy };
    }

    _dijkstraIndirect(startId, endId, maxLy, avoidIds) {
        const LY_TO_M = 9.4607e15;
        const maxM = maxLy * LY_TO_M;
        const maxMSq = maxM * maxM;

        const startInfo = this.systemInfo.get(startId);
        const endInfo = this.systemInfo.get(endId);
        if (!startInfo || !endInfo) return { success: false };

        const directDist = this.calcDistanceLy(startId, endId);
        if (directDist <= maxLy) {
            const endName = this.systemIdToName.get(endId);
            return {
                success: true,
                path: [
                    { id: startId, name: this.systemIdToName.get(startId), displayName: this.toChinese(this.systemIdToName.get(startId)), ly: 0, security: startInfo.security },
                    { id: endId, name: endName, displayName: this.toChinese(endName), ly: directDist, security: endInfo.security }
                ],
                totalLy: directDist
            };
        }

        const queue = [{ id: startId, dist: 0 }];
        const dist = new Map();
        const prev = new Map();
        dist.set(startId, 0);

        while (queue.length > 0) {
            queue.sort((a, b) => a.dist - b.dist);
            const current = queue.shift();
            if (current.id === endId) break;
            if (current.dist > dist.get(current.id)) continue;

            const curInfo = this.systemInfo.get(current.id);
            if (!curInfo) continue;

            const candidateIds = this._getNeighborCandidates(current.id, maxM);
            for (const id of candidateIds) {
                if (id === current.id || avoidIds.has(id)) continue;
                if (dist.has(id)) continue;

                const other = this.systemInfo.get(id);
                if (!other) continue;
                const dx = curInfo.x - other.x;
                if (Math.abs(dx) > maxM) continue;
                const dy = curInfo.y - other.y;
                if (Math.abs(dy) > maxM) continue;
                const dz = curInfo.z - other.z;
                if (Math.abs(dz) > maxM) continue;

                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > maxMSq) continue;
                const dLy = Math.sqrt(distSq) / LY_TO_M;
                const newDist = current.dist + dLy;

                if (!dist.has(id) || newDist < dist.get(id)) {
                    dist.set(id, newDist);
                    prev.set(id, current.id);
                    queue.push({ id, dist: newDist });
                }
            }
        }

        if (!dist.has(endId)) return { success: false };

        const path = [];
        let cur = endId;
        while (cur !== undefined) {
            const info = this.systemInfo.get(cur);
            const name = this.systemIdToName.get(cur);
            path.unshift({
                id: cur,
                name: name,
                displayName: this.toChinese(name),
                ly: cur === startId ? 0 : this.calcDistanceLy(prev.get(cur), cur),
                security: info?.security ?? null
            });
            cur = prev.get(cur);
        }

        return { success: true, path: path, totalLy: dist.get(endId) };
    }

    getSystemsWithinJumps(system, maxJumps) {
        const startInfo = this.getSystemInfo(system);
        if (!startInfo) return { success: false, error: '找不到星系: ' + system };
        const startId = startInfo.id;

        const dist = new Map();
        dist.set(startId, 0);
        const queue = [startId];
        const results = [];

        while (queue.length > 0) {
            const current = queue.shift();
            const d = dist.get(current);
            if (d >= maxJumps) continue;

            const neighbors = this.connections.get(current) || new Set();
            for (const neighbor of neighbors) {
                if (!dist.has(neighbor)) {
                    dist.set(neighbor, d + 1);
                    queue.push(neighbor);
                }
            }
        }

        for (const [id, jumpDist] of dist) {
            if (id === startId) continue;
            const name = this.systemIdToName.get(id);
            if (name) {
                const info = this.systemInfo.get(id);
                results.push({
                    id, name, jumpDist,
                    security: info?.security ?? null,
                    displayName: this.toChinese(name)
                });
            }
        }
        results.sort((a, b) => a.jumpDist - b.jumpDist);
        return { success: true, systems: results };
    }

    getNeighbors(systemId) {
        const neighbors = this.connections.get(systemId) || new Set();
        return Array.from(neighbors).map(id => this.systemIdToName.get(id)).filter(Boolean);
    }
}
