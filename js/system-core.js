/**
 * [system-core.js] 터미널 시스템 통합 엔진 v3.5
 * - 기능: GitHub API 통신, 이중 캐싱, 사이드바 필터링, 하위 폴더 인식형 인젝션
 */

const SYSTEM_CONFIG = {
    username: 'cjfwls39',
    labTopic: 'portfolio-lab',
    projectTopic: 'portfolio-project',
    rawBaseUrl: "https://raw.githubusercontent.com",
    defaultBranch: "main",
    cacheExpiry: 3600000 // 1시간
};

/**
 * 1. [ENGINE] 데이터 통신 및 로컬 캐싱
 */
async function fetchSystemData(endpoint, ignoreCache = false) {
    const cacheKey = `sys_cache_${endpoint.replace(/[\/\?&=]/g, '_')}`;
    const cached = localStorage.getItem(cacheKey);
    const now = Date.now();

    if (cached && !ignoreCache) {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < SYSTEM_CONFIG.cacheExpiry) return data;
    }

    try {
        const response = await fetch(`https://api.github.com/${endpoint}`);
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }));
        return data;
    } catch (e) {
        return cached ? JSON.parse(cached).data : null;
    }
}

function getRawContentUrl(repo, path) {
    return `${SYSTEM_CONFIG.rawBaseUrl}/${SYSTEM_CONFIG.username}/${repo}/${SYSTEM_CONFIG.defaultBranch}/${path}?t=${Date.now()}`;
}

/**
 * 2. [UI: SIDEBAR] HTML 파일만 필터링하여 노출
 */
async function buildSidebar(repoName, path = "", parentElement) {
    const contents = await fetchSystemData(`repos/${SYSTEM_CONFIG.username}/${repoName}/contents/${path}`);
    if (!contents) return;

    contents.sort((a, b) => (a.type === 'dir' ? 1 : -1));

    contents.forEach(item => {
        // 자산 폴더(css, js, images 등) 사이드바에서 제외
        const assetDirs = ['css', 'js', 'image', 'images', 'img', 'assets', 'font', 'fonts'];
        if (item.type === "dir" && assetDirs.includes(item.name.toLowerCase())) return;

        // 루트에서는 날짜 폴더만 허용
        if (path === "" && !/^\d{8}$/.test(item.name)) return;

        if (item.type === "dir") {
            const det = document.createElement("details");
            const dateLabel = path === "" ? `${item.name.substring(0,4)}년 ${item.name.substring(4,6)}월 ${item.name.substring(6,8)}일` : item.name;
            det.innerHTML = `<summary>${dateLabel}</summary>`;
            det.ontoggle = () => { if (det.open && det.children.length === 1) buildSidebar(repoName, item.path, det); };
            parentElement.appendChild(det);
        } else if (item.name.toLowerCase().endsWith('.html')) {
            // 사이드바에는 오직 HTML 파일만 표시
            const a = document.createElement("a");
            a.className = "file-link";
            a.textContent = `> ${item.name}`;
            a.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll(".file-link").forEach(el => el.classList.remove("active"));
                a.classList.add("active");
                renderProjectView(item, repoName);
            };
            parentElement.appendChild(a);
        }
    });
}

/**
 * 3. [UI: TABS & INJECTION] 하위 폴더 인식 및 에셋 자동 주입
 */
async function renderProjectView(selectedItem, repoName) {
    const tabBar = document.getElementById("tab-bar");
    const iframe = document.getElementById("main-iframe");
    if (!tabBar || !iframe) return;

    tabBar.innerHTML = "<div class='tab active'>SYSTEM_DEEP_SCAN...</div>";

    // 재귀적으로 전체 트리 구조 획득
    const treeData = await fetchSystemData(`repos/${SYSTEM_CONFIG.username}/${repoName}/git/trees/main?recursive=1`);
    if (!treeData) return;

    // 선택한 파일의 프로젝트 루트 폴더 추출 (예: 20260130/MobileFirst)
    const pathParts = selectedItem.path.split('/');
    const projectRoot = pathParts.slice(0, -1).join('/');

    // ⭐ [필터링] 해당 프로젝트 루트 하위의 모든 HTML, CSS, JS 수집 (깊이 상관없음)
    const projectResources = treeData.tree.filter(item => 
        item.path.startsWith(projectRoot + '/') && /\.(html|css|js)$/i.test(item.path)
    );

    tabBar.innerHTML = "";
    const tabConfigs = [];
    
    // Preview 탭 우선 생성
    if (selectedItem.name.endsWith('.html')) {
        tabConfigs.push({ label: "PREVIEW", type: "preview", url: getRawContentUrl(repoName, selectedItem.path) });
    }

    // ⭐ [탭 목록] 하위 폴더 경로를 포함하여 탭 생성 (예: CSS/STYLE.CSS)
    projectResources.forEach(file => {
        const relativeLabel = file.path.replace(projectRoot + '/', '').toUpperCase();
        let type = file.path.endsWith('.css') ? "css" : (file.path.endsWith('.js') ? "js" : "html");
        
        // 탭 목록에는 현재 선택한 HTML과 모든 CSS/JS만 표시 (다른 HTML 제외)
        if (file.path === selectedItem.path || type !== "html") {
            tabConfigs.push({ label: relativeLabel, type, url: getRawContentUrl(repoName, file.path) });
        }
    });

    const activateTab = async (cfg) => {
        document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.textContent === cfg.label));
        const res = await fetch(cfg.url);
        let content = await res.text();

        if (cfg.type === "preview") {
            document.getElementById("preview-pane").style.display = "block";
            document.getElementById("editor-pane").style.display = "none";
            document.getElementById("no-selection").style.display = "none";

            // [INJECTION] 이미지 경로 해결 및 코드 주입
            const baseUrl = `${SYSTEM_CONFIG.rawBaseUrl}/${SYSTEM_CONFIG.username}/${repoName}/${SYSTEM_CONFIG.defaultBranch}/${projectRoot}/`;
            let combinedCSS = "";
            let combinedJS = "";

            // 모든 하위 에셋 수집 및 태그 치환
            for (const f of projectResources) {
                const assetRes = await fetch(getRawContentUrl(repoName, f.path));
                if (!assetRes.ok) continue;
                const code = await assetRes.text();
                const relativePath = f.path.replace(projectRoot + '/', '');

                if (f.path.endsWith('.css')) {
                    combinedCSS += `\n/* ${relativePath} */\n${code}\n`;
                    // <link> 태그 제거
                    content = content.replace(new RegExp(`<link[^>]+href=["'][^"']*${relativePath}["'][^>]*>`, 'i'), "");
                }
                if (f.path.endsWith('.js')) {
                    combinedJS += `\n/* ${relativePath} */\n${code}\n`;
                    // <script> 태그 제거
                    content = content.replace(new RegExp(`<script[^>]+src=["'][^"']*${relativePath}["'][^>]*><\/script>`, 'i'), "");
                }
            }

            // HTML 재조립
            const headInject = `<base href="${baseUrl}"><style>${combinedCSS}</style>`;
            const bodyInject = `<script>document.addEventListener('DOMContentLoaded', () => {${combinedJS}});</script>`;
            
            content = content.includes('<head>') ? content.replace('<head>', `<head>${headInject}`) : headInject + content;
            content = content.includes('</body>') ? content.replace('</body>', `${bodyInject}</body>`) : content + bodyInject;

            iframe.srcdoc = content;
        } else {
            // [EDITOR] 소스코드 출력
            document.getElementById("preview-pane").style.display = "none";
            document.getElementById("editor-pane").style.display = "block";
            document.getElementById("editor-pane").innerHTML = `<pre><code>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
        }
    };

    tabConfigs.forEach((cfg, idx) => {
        const tab = document.createElement("div");
        tab.className = "tab";
        tab.textContent = cfg.label;
        tab.onclick = () => activateTab(cfg);
        tabBar.appendChild(tab);
        if (idx === 0) activateTab(cfg);
    });
}

/**
 * 4. [INIT] 시스템 가동
 */
async function initializeSystem() {
    const repos = await fetchSystemData(`users/${SYSTEM_CONFIG.username}/repos?sort=updated&per_page=100`);
    if (!repos) return;

    // 실습실 초기화
    const labSidebar = document.getElementById("file-list-container");
    if (labSidebar) {
        const labRepos = repos.filter(r => r.topics && r.topics.includes(SYSTEM_CONFIG.labTopic));
        labRepos.forEach(repo => buildSidebar(repo.name, "", labSidebar));
    }
}

document.addEventListener('DOMContentLoaded', initializeSystem);