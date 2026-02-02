const toggleBtn = document.querySelector('.menu-toggle-btn');
const nav = document.querySelector('nav');

toggleBtn.addEventListener('click', () => {
    nav.classList.toggle('is-open');
});