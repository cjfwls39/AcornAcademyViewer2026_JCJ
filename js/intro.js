/**
 * [intro.js]
 * 캐릭터 시선 추적, 눈물 애니메이션, 사이트 종료 연출을 담당하는 스크립트입니다.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 주요 DOM 요소 선택
    const overlay = document.getElementById('intro-overlay');
    const enterBtn = document.getElementById('enter-btn');
    const closeBtn = document.getElementById('close-btn'); // X 버튼
    const eyes = document.querySelectorAll('.eye');         // 캐릭터 눈(흰자)
    const tears = document.querySelectorAll('.tear');       // 캐릭터 눈물

    /**
     * [시선 추적 로직]
     * 마우스 좌표를 계산하여 눈동자(pupil)가 마우스를 바라보게 합니다.
     */
    function handleMouseMove(event) {
        // 현재 브라우저 창 내에서의 마우스 좌표
        const { clientX, clientY } = event;

        eyes.forEach(eye => {
            const pupil = eye.querySelector('.pupil');
            
            // 눈(흰자)의 화면상 위치와 크기 정보를 실시간으로 가져옴
            const rect = eye.getBoundingClientRect();
            
            // 눈의 중심점 계산
            const eyeCenterX = rect.left + rect.width / 2;
            const eyeCenterY = rect.top + rect.height / 2;

            // [수학] 눈 중심에서 마우스까지의 각도($\theta$) 구하기 (라디안 값)
            const angle = Math.atan2(clientY - eyeCenterY, clientX - eyeCenterX);
            
            // 눈동자가 이동할 최대 반경 (흰자 밖으로 나가지 않을 정도)
            const maxMove = 10; 

            // [수학] 삼각함수를 사용하여 x, y 축 이동 거리 계산
            // 각도 방향으로 maxMove만큼 이동한 지점의 좌표를 구함
            const moveX = Math.cos(angle) * maxMove;
            const moveY = Math.sin(angle) * maxMove;

            // [성능 최적화] CSS 변수(--eye-x, --eye-y)를 업데이트하여 
            // CSS의 transform: translate()가 처리하게 함 (GPU 가속 활용)
            pupil.style.setProperty('--eye-x', `${moveX}px`);
            pupil.style.setProperty('--eye-y', `${moveY}px`);
        });
    }

    // ---------------------------------------------------------
    // 2. 이벤트 리스너: 입장 버튼 (Connect to Site)
    // ---------------------------------------------------------
    enterBtn.addEventListener('click', () => {
        // 인트로 오버레이 숨김 (CSS transition 발생)
        overlay.classList.add('hidden');
        
        // 인트로가 끝났으므로 마우스 추적 이벤트를 제거하여 메모리 절약
        document.removeEventListener('mousemove', handleMouseMove);
        
        // 브라우저 세션에 기록하여 새로고침 시 인트로 생략 가능하게 함
        sessionStorage.setItem('introSeen', 'true');
    });

    // ---------------------------------------------------------
    // 3. 이벤트 리스너: 닫기 버튼 (X 버튼 및 눈물 인터랙션)
    // ---------------------------------------------------------
    
    // 마우스를 X 버튼 위에 올렸을 때: 캐릭터가 눈물을 흘림
    closeBtn.addEventListener('mouseenter', () => {
        tears.forEach(tear => {
            tear.classList.add('falling'); // CSS 애니메이션 클래스 추가
        });
    });

    // 마우스가 X 버튼을 벗어났을 때: 눈물을 멈춤
    closeBtn.addEventListener('mouseleave', () => {
        tears.forEach(tear => {
            tear.classList.remove('falling');
        });
    });

    // X 버튼 클릭 시: 사이트 종료 연출
    closeBtn.addEventListener('click', () => {
        // 화면을 암전시키고 종료 메시지 출력
        overlay.style.backgroundColor = '#000000';
        overlay.innerHTML = `
            <div style="text-align: center; color: #ef4444; font-family: 'Pretendard', sans-serif;">
                <h1 style="font-size: 3rem; margin-bottom: 20px;">사이트가 종료되었습니다.</h1>
                <p style="color: #94a3b8; font-size: 1.2rem;">이 탭을 닫으셔도 좋습니다.</p>
            </div>
        `;
        
        // 이벤트 제거
        document.removeEventListener('mousemove', handleMouseMove);
    });

    // ---------------------------------------------------------
    // 4. 초기화 및 세션 체크
    // ---------------------------------------------------------
    
    // 마우스 움직임 감지 시작
    document.addEventListener('mousemove', handleMouseMove);

    // 이미 인트로를 본 사용자라면 오버레이를 즉시 제거
    if (sessionStorage.getItem('introSeen')) {
        overlay.style.display = 'none';
        document.removeEventListener('mousemove', handleMouseMove);
    }
});