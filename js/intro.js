/* [js/intro.js] 스포트라이트, 자동 오픈 및 세션 체크 */

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('intro-overlay');

    // 1. 세션 체크: 이미 인트로를 본 기록이 있는지 확인합니다.
    if (sessionStorage.getItem('introSeen') === 'true') {
        // 이미 봤다면 인트로 레이어를 즉시 제거하여 본문을 보여줍니다.
        overlay.style.display = 'none';
        return; // 아래 로직(스포트라이트, 타이머 등)을 실행하지 않고 종료합니다.
    }

    // 2. 스포트라이트 좌표 계산 (인트로를 처음 보는 경우에만 실행됨)
    window.addEventListener('mousemove', (e) => {
        overlay.style.setProperty('--mouse-px-x', `${e.clientX}px`);
        overlay.style.setProperty('--mouse-px-y', `${e.clientY}px`);
    });

    // 3. 2.5초 뒤 커튼이 열리며 본문 공개
    setTimeout(() => {
        overlay.classList.add('hidden');
        
        // 인트로 연출이 시작되었음을 세션에 기록합니다.
        sessionStorage.setItem('introSeen', 'true');
    }, 2500);
});