/**
 * [최종 통합 완성본 script.js] 
 * 1. 이중 캐시: 일반(1시간) 및 비상(API 제한 리셋 시까지) 모드 제어
 * 2. 상세 로깅: 데이터 출처 및 API 상태 실시간 콘솔 출력
 * 3. 범용 경로 대응: <base> 태그 주입으로 이미지/리소스 경로 문제 해결
 * 4. UX 최적화: 사이드바 HTML 전용 필터링 및 소스 탭 자동 생성
 */

const GITHUB_CONFIG = {
  username: 'cjfwls39',
  projectTopic: 'portfolio-project',
  labTopic: 'portfolio-lab',

  // ⭐ 호스팅 서비스에 따라 이 부분만 수정하면 됩니다.
  rawBaseUrl: "https://raw.githubusercontent.com", 
  defaultBranch: "main",
  normalExpiry: 3600000 // 일반 캐시 유효 시간: 1시간

  // 나중에 .env 사용해서 싹다 환경변수 사용해서 보안성 높이는게 좋아보임
};

let editor = null;

/**
 * [1. Helper] 날짜 변환 함수 (ReferenceError 방지를 위해 상단 배치)
 */
function formatDateString(dateStr) {
  if (!/^\d{8}$/.test(dateStr)) return dateStr;
  return `${dateStr.substring(0, 4)}년 ${dateStr.substring(4, 6)}월 ${dateStr.substring(6, 8)}일`;
}

/**
 * [2. Helper] Raw URL 생성 (호스팅 환경 대응)
 */
function getRawUrl(repoName, filePath) {
  return `${GITHUB_CONFIG.rawBaseUrl}/${GITHUB_CONFIG.username}/${repoName}/${GITHUB_CONFIG.defaultBranch}/${filePath}`;
}

// Monaco Editor 초기화
if (typeof require !== 'undefined') {
  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
  require(["vs/editor/editor.main"], function () {
    const container = document.getElementById("editor-pane");
    if (!container) return;
    editor = monaco.editor.create(container, {
      value: "// 왼쪽 메뉴에서 파일을 선택하세요.",
      language: "html", theme: "vs-dark", automaticLayout: true, readOnly: true, fontSize: 14,
    });
  });
}

/**
 * [3. Core] 이중 캐시 및 상세 로그 포함 API 호출
 */
async function fetchGH(endpoint) {
  const cacheKey = `gh_cache_${endpoint.replace(/[\/\?&=]/g, '_')}`;
  const resetKey = `gh_limit_reset`;
  const now = Date.now();
  const limitResetTime = parseInt(localStorage.getItem(resetKey) || 0);
  const cached = localStorage.getItem(cacheKey);

  console.groupCollapsed(`🚀 [GitHub API] 호출 시도: ${endpoint}`);

  // 비상 모드 체크
  if (now < limitResetTime && cached) {
    const remaining = Math.ceil((limitResetTime - now) / 60000);
    console.warn(`[비상 모드] 제한 해제까지 약 ${remaining}분 남음. 기존 데이터를 고정 사용합니다.`);
    console.groupEnd();
    return JSON.parse(cached).data;
  }

  // 일반 캐시 체크
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (now - timestamp < GITHUB_CONFIG.normalExpiry) {
      console.log(`[Cache Hit] 신선한 캐시 사용 (${Math.floor((now - timestamp) / 60000)}분 경과)`);
      console.groupEnd();
      return data;
    }
    console.log(`[Cache Expired] 캐시 만료. 새로 호출합니다.`);
  }

  try {
    const response = await fetch(`https://api.github.com/${endpoint}`);
    
    if (response.status === 403) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      if (resetHeader) localStorage.setItem(resetKey, parseInt(resetHeader) * 1000);
      
      if (cached) {
          console.error(`[Limit Exceeded] 비상 모드 진입. 기존 데이터를 유지합니다.`);
          console.groupEnd();
          return JSON.parse(cached).data;
      }
    }

    const data = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }));
    console.log(`[Success] API 호출 성공 및 캐시 갱신`);
    console.groupEnd();
    return data;
  } catch (e) {
    console.error(`[Error] 호출 실패:`, e);
    console.groupEnd();
    return cached ? JSON.parse(cached).data : null;
  }
}

/**
 * [4. Lab] 탭 생성 및 경로 최적화 (Iframe 해결)
 */
async function renderSourceTabs(selectedItem, repoName) {
  const tabBar = document.getElementById("tab-bar");
  const iframe = document.getElementById("main-iframe");
  const placeholder = document.getElementById("no-selection");
  if (!tabBar || !iframe) return;

  tabBar.innerHTML = "<div class='tab loading'>Sources Loading...</div>";

  // Trees API로 전체 구조 획득
  const treeData = await fetchGH(`repos/${GITHUB_CONFIG.username}/${repoName}/git/trees/main?recursive=1`);
  if (!treeData) return;

  const pathParts = selectedItem.path.split('/');
  const projectRootPath = pathParts.slice(0, 2).join('/'); 
  const allSources = treeData.tree.filter(item => 
    item.path.startsWith(projectRootPath) && /\.(html|css|js)$/i.test(item.path)
  );

  tabBar.innerHTML = "";
  const tabConfigs = [];
  if (selectedItem.name.endsWith('.html')) {
    tabConfigs.push({ label: "Preview", type: "preview", url: getRawUrl(repoName, selectedItem.path) });
  }

  const selectedBaseName = selectedItem.name.split('.').slice(0, -1).join('.').toLowerCase();
  const relatedSources = allSources.filter(s => {
      const name = s.path.split('/').pop();
      const base = name.split('.').slice(0, -1).join('.').toLowerCase();
      return base === selectedBaseName || ['style', 'script', 'common', 'reset'].includes(base);
  });

  relatedSources.forEach(file => {
    let lang = "html";
    const ext = file.path.split('.').pop().toLowerCase();
    if (ext === "css") lang = "css";
    if (ext === "js") lang = "javascript";
    tabConfigs.push({ label: file.path.replace(projectRootPath + "/", "").toUpperCase(), type: lang, url: getRawUrl(repoName, file.path) });
  });

  const loadTab = async (cfg) => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(t => { if(t.textContent === cfg.label) t.classList.add("active"); });

    console.log(`📂 [파일 로드] ${cfg.label}`);
    let response = await fetch(cfg.url);
    if (!response.ok && GITHUB_CONFIG.defaultBranch === "main") {
        response = await fetch(cfg.url.replace('/main/', '/master/')); // 브랜치 예외 처리
    }
    let content = await response.text();

    if (cfg.type === "preview") {
      document.getElementById("preview-pane").style.display = "block";
      document.getElementById("editor-pane").style.display = "none";
      iframe.style.display = "block";
      if (placeholder) placeholder.style.display = "none";

      // ⭐ [중요] <base> 태그 주입으로 호스팅 경로 문제 해결
      const folderPath = selectedItem.path.split('/').slice(0, -1).join('/');
      const baseUrl = `${getRawUrl(repoName, folderPath)}/`;
      const baseTag = `<base href="${baseUrl}">`;
      
      content = content.includes('<head>') ? content.replace('<head>', `<head>${baseTag}`) : baseTag + content;

      // CSS/JS 직접 주입
      for (const s of allSources) {
          const rawUrl = getRawUrl(repoName, s.path);
          if (s.path.endsWith('.css')) {
              const res = await fetch(rawUrl);
              if (res.ok) content = content.replace(/<link[^>]+href=["'][^"']+["'][^>]*>/i, `<style>${await res.text()}</style>`);
          }
          if (s.path.endsWith('.js')) {
              const res = await fetch(rawUrl);
              if (res.ok) content = content.replace(/<script[^>]+src=["'][^"']+["'][^>]*><\/script>/i, `<script>${await res.text()}</script>`);
          }
      }
      iframe.srcdoc = content;
    } else {
      document.getElementById("preview-pane").style.display = "none";
      document.getElementById("editor-pane").style.display = "block";
      const model = monaco.editor.createModel(content, cfg.type);
      editor.setModel(model);
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

/**
 * [5. Lab] 트리 메뉴 생성
 */
async function loadRepoContents(repoName, path = "", parentElement) {
  const contents = await fetchGH(`repos/${GITHUB_CONFIG.username}/${repoName}/contents/${path}`);
  if (!contents) return;

  contents.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return 1;
    if (a.type !== 'dir' && b.type === 'dir') return -1;
    return a.name.localeCompare(b.name);
  });

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
      const sum = document.createElement("summary");
      sum.textContent = path === "" ? `📅 ${formatDateString(item.name)}` : `📁 ${item.name}`;
      det.appendChild(sum);
      det.ontoggle = () => { if (det.open && det.children.length === 1) loadRepoContents(repoName, item.path, det); };
      parentElement.appendChild(det);
    } else {
      const a = document.createElement("a");
      a.className = "file-link";
      a.textContent = `📄 ${item.name}`;
      a.href = "#";
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

/**
 * [6. Projects] 카드 렌더링
 */
function renderProjects(repos) {
  const grid = document.querySelector('.project-grid');
  if (!grid) return;
  grid.innerHTML = repos.map(repo => `
    <div class="project-card">
      <div class="card-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--bg-sub)">
        <i class="fab fa-github" style="font-size:3rem;color:var(--brand-color);opacity:0.2"></i>
      </div>
      <div class="card-body">
        <h3>${repo.name.replace(/-/g, ' ')}</h3>
        <p>${repo.description || ''}</p>
        <a href="${repo.html_url}" target="_blank" class="detail-link">View Repo →</a>
      </div>
    </div>
  `).join('');
}

async function init() {
  console.log("%c🌟 포트폴리오 데이터 로드 시작", "color: #0ea5e9; font-weight: bold; font-size: 1.2rem;");
  const repos = await fetchGH(`users/${GITHUB_CONFIG.username}/repos?sort=updated&per_page=100`);
  if (!repos) return;

  const projects = repos.filter(r => r.topics.includes(GITHUB_CONFIG.projectTopic));
  const labs = repos.filter(r => r.topics.includes(GITHUB_CONFIG.labTopic));
  
  if (document.querySelector('.projects-container')) renderProjects(projects);
  const labContainer = document.getElementById("file-list-container");
  if (labContainer) labs.forEach(repo => loadRepoContents(repo.name, "", labContainer));
}

init();