/**
 * [최종 완성본 script.js] 
 * 1. 이중 캐시: 일반(1시간) & 비상(제한 해제 시까지) 모드
 * 2. 상세 로깅: API 상태 및 캐시 여부 실시간 표시
 * 3. UX 최적화: 사이드바 HTML 전용, 탭 소스 통합 뷰어
 */

const GITHUB_CONFIG = {
  username: 'cjfwls39',
  projectTopic: 'portfolio-project',
  labTopic: 'portfolio-lab',
  normalExpiry: 3600000 // 1시간
};

let editor = null;

/**
 * [1. Helper] 에러 방지를 위해 날짜 변환 함수를 최상단에 배치합니다.
 */
function formatDateString(dateStr) {
  if (!/^\d{8}$/.test(dateStr)) return dateStr;
  return `${dateStr.substring(0, 4)}년 ${dateStr.substring(4, 6)}월 ${dateStr.substring(6, 8)}일`;
}

// Monaco Editor 초기화
if (typeof require !== 'undefined') {
  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
  require(["vs/editor/editor.main"], function () {
    const container = document.getElementById("editor-pane");
    if (!container) return;
    editor = monaco.editor.create(container, {
      value: "// 파일을 선택해 주세요.",
      language: "html", theme: "vs-dark", automaticLayout: true, readOnly: true, fontSize: 14,
    });
  });
}

/**
 * [2. Core] 이중 캐시 제어 및 로그 포함 API 호출
 */
async function fetchGH(endpoint) {
  const cacheKey = `gh_cache_${endpoint.replace(/[\/\?&=]/g, '_')}`;
  const resetKey = `gh_limit_reset`;
  const now = Date.now();
  const limitResetTime = parseInt(localStorage.getItem(resetKey) || 0);
  const cached = localStorage.getItem(cacheKey);

  console.groupCollapsed(`🚀 [GitHub API] 호출 시도: ${endpoint}`);

  // ⭐ 비상 모드: 제한 해제 시간(Reset Time)까지는 무조건 캐시 사용
  if (now < limitResetTime && cached) {
    const remaining = Math.ceil((limitResetTime - now) / 60000);
    console.warn(`[비상 모드] 제한 해제까지 약 ${remaining}분 남음. 캐시를 강제 고정합니다.`);
    console.groupEnd();
    return JSON.parse(cached).data;
  }

  // ⭐ 일반 모드: 1시간 유효 기간 체크
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (now - timestamp < GITHUB_CONFIG.normalExpiry) {
      console.log(`[Cache Hit] 신선한 캐시 사용 (${Math.floor((now - timestamp) / 60000)}분 경과)`);
      console.groupEnd();
      return data;
    }
    console.log(`[Cache Expired] 데이터가 낡아 새로 호출합니다.`);
  } else {
    console.log(`[No Cache] 첫 방문 혹은 캐시 없음. 실시간 호출 시작.`);
  }

  try {
    const response = await fetch(`https://api.github.com/${endpoint}`);
    
    // API 제한(403) 도달 시 비상 모드 값 설정
    if (response.status === 403) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      if (resetHeader) {
        const resetTs = parseInt(resetHeader) * 1000;
        localStorage.setItem(resetKey, resetTs);
        console.error(`[Limit Exceeded] 제한 도달. 리셋 시간: ${new Date(resetTs).toLocaleTimeString()}`);
      }
      if (cached) {
        console.warn("[Fallback] 비상 모드로 전환하며 기존 데이터를 동결합니다.");
        console.groupEnd();
        return JSON.parse(cached).data;
      }
    }

    const data = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }));
    console.log(`[Success] API 호출 성공 및 캐시 갱신 완료`);
    console.groupEnd();
    return data;
  } catch (e) {
    console.groupEnd();
    return cached ? JSON.parse(cached).data : null;
  }
}

/**
 * [3. Lab] 탭 생성 및 소스 주입
 */
async function renderSourceTabs(selectedItem, repoName) {
  const tabBar = document.getElementById("tab-bar");
  const iframe = document.getElementById("main-iframe");
  if (!tabBar || !iframe) return;

  tabBar.innerHTML = "<div class='tab loading'>Sources Loading...</div>";

  // Trees API로 한 번에 모든 구조 가져오기 (캐시 적용)
  const treeData = await fetchGH(`repos/${GITHUB_CONFIG.username}/${repoName}/git/trees/main?recursive=1`);
  if (!treeData) return;

  const projectRootPath = selectedItem.path.split('/').slice(0, 2).join('/'); 
  const allSources = treeData.tree.filter(item => 
    item.path.startsWith(projectRootPath) && /\.(html|css|js)$/i.test(item.path)
  );

  tabBar.innerHTML = "";
  const tabConfigs = [];
  if (selectedItem.name.endsWith('.html')) {
    tabConfigs.push({ label: "Preview", type: "preview", url: `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${repoName}/main/${selectedItem.path}` });
  }

  const selectedBaseName = selectedItem.name.split('.').slice(0, -1).join('.').toLowerCase();
  const relatedSources = allSources.filter(s => {
      const name = s.path.split('/').pop();
      const base = name.split('.').slice(0, -1).join('.').toLowerCase();
      return base === selectedBaseName || ['style', 'script', 'common', 'reset'].includes(base);
  });

  relatedSources.forEach(file => {
    let lang = "html";
    if (file.path.endsWith(".css")) lang = "css";
    if (file.path.endsWith(".js")) lang = "javascript";
    tabConfigs.push({ label: file.path.replace(projectRootPath + "/", "").toUpperCase(), type: lang, url: `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${repoName}/main/${file.path}` });
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

      for (const s of allSources) {
          const rawUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${repoName}/main/${s.path}`;
          if (s.path.endsWith('.css')) {
              const res = await fetch(rawUrl);
              content = content.replace(/<link[^>]+href=["'][^"']+["'][^>]*>/i, `<style>${await res.text()}</style>`);
          }
          if (s.path.endsWith('.js')) {
              const res = await fetch(rawUrl);
              content = content.replace(/<script[^>]+src=["'][^"']+["'][^>]*><\/script>/i, `<script>${await res.text()}</script>`);
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
 * [4. Lab] 트리 메뉴 생성 (필터링 적용)
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
 * [5. Projects] 카드 렌더링
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

/**
 * [6. Init] 전체 초기화 실행
 */
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