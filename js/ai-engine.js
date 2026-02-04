/**
 * [ai-engine.js] 한글 부팅 복구 및 명령어 처리 엔진
 */
const input = document.getElementById('terminal-input');

/**
 * 1. 부팅 시퀀스 복구
 * ⭐ 기존에 사용하던 로그 출력 방식과 인트로 제거 타이밍을 복구했습니다.
 */
async function bootSystem() {
    const logBox = document.getElementById('boot-log');
    if (!logBox) return;

    const logs = [
        "JCJ_PORTFOLIO_SYSTEM v2.0 하드웨어 무결성 검사 중...",
        "데이터베이스(GitHub API) 연결 시도 중...",
        "로컬 캐시 데이터 동기화 완료.",
        "AI 어시스턴트 로딩 중...",
        "준비되었습니다. 명령을 대기합니다."
    ];

    for (let log of logs) {
        const p = document.createElement('div');
        p.className = 'log-line';
        p.innerText = `> ${log}`;
        logBox.appendChild(p);
        await new Promise(r => setTimeout(r, 400)); // 부팅 로그 출력 속도
    }

    // 부팅 완료 후 인트로 오버레이 제거
    setTimeout(() => {
        const overlay = document.getElementById('intro-overlay');
        if (overlay) overlay.style.display = 'none';
        executeCmd('welcome'); 
    }, 1000);
}

/**
 * 2. 명령어 실행 로직
 */
async function executeCmd(cmd) {
    const output = document.getElementById('ai-response');
    if (!output) return;

    cmd = cmd.replace('--', '').trim();

    if (cmd === 'welcome') {
        await typeWriter("ai-response", `시스템에 오신 것을 환영합니다.\n하단의 명령어를 클릭하거나 직접 입력하세요.`);
    } else if (cmd === '소개') {
        // 상단 멘트 타이핑
        await typeWriter("ai-response", "사용자 프로필 데이터를 스캔합니다... 분석 완료.\n");

        // 중앙 정렬된 프로필 카드 HTML 주입
        const profileCardHtml = `
            <div class="profile-card">
                <div class="profile-info">
                    <div class="info-item"><span class="info-label">이름</span><span class="info-value">정철진 (Jung Cheol Jin)</span></div>
                    <div class="info-item"><span class="info-label">나이</span><span class="info-value">25</span></div>
                    <div class="info-item"><span class="info-label">주소</span><span class="info-value">경기도_안산시</span></div>
                    <div class="info-item"><span class="info-label">학력</span><span class="info-value">안산대학교_컴퓨터정보학과</span></div>
                    <div class="info-item"><span class="info-label">자격</span><span class="info-value">정보처리기능사, 정보기기운용기능사</span></div>
                    <div class="info-item"><span class="info-label">번호</span><span class="info-value">010-8464-6539</span></div>
                    <div class="info-item"><span class="info-label">링크</span><span class="info-value"><a href="https://github.com/cjfwls39" target="_blank" style="color:inherit; text-decoration:underline;">GITHUB_STORAGE</a></span></div>
                </div>
                <div class="profile-pic-area">
                    <div class="image-placeholder"></div>
                    <span style="font-size:0.7rem; opacity:0.6; margin-top:5px;">[PHOTO_ID: 0045]</span>
                </div>
            </div>
        `;
        
        output.innerHTML += profileCardHtml;

    } else if (cmd === '연구실') {
        await typeWriter("ai-response", "연구실(Lab) 아카이브로 접속합니다.\n실습 코드를 불러오는 중...");
        setTimeout(() => location.href = 'lab.html', 1500);
    } else if (cmd === '프로젝트') {
        await typeWriter("ai-response", "수행한 프로젝트 목록을 분석합니다.\n잠시만 기다려 주세요.");
        setTimeout(() => location.href = 'projects.html', 1500);
    } else {
        await typeWriter("ai-response", `에러: '${cmd}'은(는) 알 수 없는 명령어입니다.\n하단 메뉴를 확인하세요.`);
    }
}

/**
 * 3. 타이핑 효과 함수
 */
async function typeWriter(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = ""; 
    for (let char of text) {
        el.innerHTML += char === '\n' ? '<br>' : char;
        await new Promise(r => setTimeout(r, 25));
    }
}

// 엔터 키 입력 처리
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        executeCmd(input.value);
        input.value = '';
    }
});

// 시스템 시작 (부팅 시퀀스 호출)
bootSystem();