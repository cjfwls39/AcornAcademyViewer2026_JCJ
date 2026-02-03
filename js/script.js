/**
 * [최종 해결본 script.js]
 * 1. 유연한 경로 탐색: 파일이 몇 단계 하위 폴더에 있든 부모 폴더를 기준으로 모든 소스 검색
 * 2. 안전한 인젝션: TypeError 방지를 위해 JS 코드를 HTML 하단에 배치 시도
 * 3. 스마트 동기화 및 이중 캐시 유지
 */

const GITHUB_CONFIG = {
    username: 'cjfwls39',
    projectTopic: 'portfolio-project',
    labTopic: 'portfolio-lab',
    rawBaseUrl: "https://raw.githubusercontent.com",
    defaultBranch: "main",
    normalExpiry: 3600000 
};

let editor = null;

/* [1. Helper] 날짜 변환 함수 (최상단 배치로 에러 방지) */
function formatDateString(dateStr) {
    if (!/^\d{8}$/.test(dateStr)) return dateStr;
    return `${dateStr.substring(0, 4)}년 ${dateStr.substring(4, 6)}월 ${dateStr.substring(6, 8)}일`;
}

function getRawUrl(repoName, filePath) {
    return `${GITHUB_CONFIG.rawBaseUrl}/${GITHUB_CONFIG.username}/${repoName}/${GITHUB_CONFIG.defaultBranch}/${filePath}?t=${Date.now()}`;
}

/* [2. Core] API 호출 로직 */
async function fetchGH(endpoint, forceRefresh = false) {
    const cacheKey = `gh_cache_${endpoint.replace(/[\/\?&=]/g, '_')}`;
    const resetKey = `gh_limit_reset`;
    const now = Date.now();
    const limitResetTime = parseInt(localStorage.getItem(resetKey) || 0);
    const cached = localStorage.getItem(cacheKey);

    console.groupCollapsed(`🚀 [API] ${endpoint}`);

    if (now < limitResetTime && cached && !forceRefresh) {
        console.groupEnd();
        return JSON.parse(cached).data;
    }

    if (cached && !forceRefresh) {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < GITHUB_CONFIG.normalExpiry) {
            console.groupEnd();
            return data;
        }
    }

    try {
        const response = await fetch(`https://api.github.com/${endpoint}`);
        if (response.status === 403) {
            const resetHeader = response.headers.get('x-ratelimit-reset');
            if (resetHeader) localStorage.setItem(resetKey, parseInt(resetHeader) * 1000);
            console.groupEnd();
            return cached ? JSON.parse(cached).data : null;
        }
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }));
        console.groupEnd();
        return data;
    } catch (e) {
        console.groupEnd();
        return cached ? JSON.parse(cached).data : null;
    }
}

/**
 * [실행 타이밍 최적화 버전] 
 * 1. JS 코드를 수집하여 </body> 바로 직전에 주입함으로써 요소 탐색 에러(null) 방지
 * 2. CSS는 <head>에 주입하여 스타일 깜빡임 방지
 */
async function renderSourceTabs(selectedItem, repoName) {
    const tabBar = document.getElementById("tab-bar");
    const iframe = document.getElementById("main-iframe");
    if (!tabBar || !iframe) return;

    tabBar.innerHTML = "<div class='tab loading'>Applying Scripts...</div>";

    const treeData = await fetchGH(`repos/${GITHUB_CONFIG.username}/${repoName}/git/trees/main?recursive=1`);
    if (!treeData) return;

    const lastSlashIndex = selectedItem.path.lastIndexOf('/');
    const projectFolder = lastSlashIndex !== -1 ? selectedItem.path.substring(0, lastSlashIndex) : "";
    
    const allFiles = treeData.tree.filter(item => 
        item.path.startsWith(projectFolder) && /\.(html|css|js)$/i.test(item.path)
    );

    tabBar.innerHTML = "";
    const tabConfigs = [];
    if (selectedItem.name.endsWith('.html')) {
        tabConfigs.push({ label: "Preview", type: "preview", url: getRawUrl(repoName, selectedItem.path) });
    }

    allFiles.forEach(file => {
        let lang = file.path.endsWith(".css") ? "css" : (file.path.endsWith(".js") ? "javascript" : "html");
        tabConfigs.push({ label: file.path.replace(projectFolder + "/", "").toUpperCase(), type: lang, url: getRawUrl(repoName, file.path) });
    });

    const loadTab = async (cfg) => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        const tabs = document.querySelectorAll(".tab");
        tabs.forEach(t => { if(t.textContent === cfg.label) t.classList.add("active"); });

        const response = await fetch(cfg.url);
        let content = await response.text();

        if (cfg.type === "preview") {
            document.getElementById("preview-pane").style.display = "block";
            document.getElementById("editor-pane").style.display = "none";
            iframe.style.display = "block";
            document.getElementById("no-selection").style.display = "none";

            const baseUrl = `${GITHUB_CONFIG.rawBaseUrl}/${GITHUB_CONFIG.username}/${repoName}/${GITHUB_CONFIG.defaultBranch}/${projectFolder}/`;
            content = content.includes('<head>') 
                ? content.replace('<head>', `<head><base href="${baseUrl}">`) 
                : `<base href="${baseUrl}">` + content;

            let combinedJS = ""; // ⭐ 모든 JS 코드를 모아둘 변수

            for (const s of allFiles) {
                const res = await fetch(getRawUrl(repoName, s.path));
                if (res.ok) {
                    const code = await res.text();
                    const fileName = s.path.split('/').pop();
                    
                    if (s.path.endsWith('.css')) {
                        const cssRegex = new RegExp(`<link[^>]+href=["'][^"']*${fileName}["'][^>]*>`, 'i');
                        content = content.replace(cssRegex, `<style>${code}</style>`);
                    }
                    if (s.path.endsWith('.js')) {
                        // ⭐ JS는 바로 주입하지 않고 따로 보관합니다.
                        combinedJS += `\n/* Source: ${fileName} */\n${code}\n`;
                        const jsRegex = new RegExp(`<script[^>]+src=["'][^"']*${fileName}["'][^>]*><\/script>`, 'i');
                        content = content.replace(jsRegex, ""); // 기존 태그는 제거
                    }
                }
            }
            
            // ⭐ HTML 맨 마지막 </body> 바로 앞에 수집한 JS를 주입합니다.
            const scriptTag = `<script>\ndocument.addEventListener('DOMContentLoaded', () => {\n${combinedJS}\n});\n<\/script>`;
            content = content.includes('</body>') 
                ? content.replace('</body>', `${scriptTag}</body>`) 
                : content + scriptTag;

            iframe.srcdoc = content;
        } else {
            document.getElementById("preview-pane").style.display = "none";
            document.getElementById("editor-pane").style.display = "block";
            editor.setModel(monaco.editor.createModel(content, cfg.type));
        }
    };

    tabConfigs.forEach((cfg, idx) => {
        const tab = document.createElement("div");
        tab.className = "tab";
        tab.textContent = cfg.label;
        tab.onclick = () => loadTab(cfg);
        tabBar.appendChild(tab);
        if (idx === 0) loadTab(cfg);
    });
}

// 트리 메뉴 로드 로직
async function loadRepoContents(repoName, path = "", parentElement) {
    const contents = await fetchGH(`repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`);
    if (!contents) return;

    contents.sort((a, b) => (a.type === 'dir' ? 1 : -1));

    contents.forEach(item => {
        if (path === "") {
            if (item.type !== "dir" || !/^\d{8}$/.test(item.name)) return;
        } else {
            const utils = ['css', 'js', 'image', 'images', 'img', 'assets', 'font', 'fonts'];
            if (item.type === "dir" && utils.includes(item.name.toLowerCase())) return;
            if (item.type === "file" && !item.name.toLowerCase().endsWith('.html')) return;
        }

        if (item.type === "dir") {
            const det = document.createElement("details");
            det.innerHTML = `<summary>${path === "" ? `📅 ${formatDateString(item.name)}` : `📁 ${item.name}`}</summary>`;
            det.ontoggle = () => { if (det.open && det.children.length === 1) loadRepoContents(repoName, item.path, det); };
            parentElement.appendChild(det);
        } else {
            const a = document.createElement("a");
            a.className = "file-link";
            a.textContent = `📄 ${item.name}`;
            a.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll(".file-link").forEach(el => el.classList.remove("active"));
                a.classList.add("active");
                renderSourceTabs(item, repoName);
            };
            parentElement.appendChild(a);
        }
    });
}

async function init() {
    if (typeof require !== 'undefined') {
        require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
        require(["vs/editor/editor.main"], () => {
            const container = document.getElementById("editor-pane");
            if (container) editor = monaco.editor.create(container, { theme: "vs-dark", automaticLayout: true, readOnly: true });
        });
    }

    const repos = await fetchGH(`users/${GITHUB_CONFIG.username}/repos?sort=updated&per_page=100`, true);
    if (!repos) return;

    const labs = repos.filter(r => r.topics.includes(GITHUB_CONFIG.labTopic));
    const projects = repos.filter(r => r.topics.includes(GITHUB_CONFIG.projectTopic));

    labs.forEach(repo => {
        const lastPushed = new Date(repo.pushed_at).getTime();
        const treeKey = `gh_cache_repos_${GITHUB_CONFIG.username}_${repo.name}_git_trees_main_recursive_1`;
        const cached = localStorage.getItem(treeKey);
        if (cached && lastPushed > JSON.parse(cached).timestamp) localStorage.removeItem(treeKey);
    });

    if (document.querySelector('.projects-container')) { /* 프로젝트 렌더링 생략 */ }
    const labContainer = document.getElementById("file-list-container");
    if (labContainer) labs.forEach(repo => loadRepoContents(repo.name, "", labContainer));
}

init();