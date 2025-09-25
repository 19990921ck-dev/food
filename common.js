document.addEventListener('DOMContentLoaded', () => {
    // 延遲一小段時間確保 header.js 已將 HTML 插入
    setTimeout(initializeCommonFeatures, 50);
});

function initializeCommonFeatures() {
    // --- 元素選取 ---
    const hamburgerBtn = document.querySelector('.hamburger-button');
    const navMenu = document.querySelector('.navigation-menu');
    const logoutBtn = document.getElementById('common-logout-btn');
    const resetSettingsBtn = document.getElementById('common-reset-settings-btn');
    const usernameDisplay = document.getElementById('header-username');

    // --- 功能 1: 漢堡選單開關 ---
    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('is-active');
            hamburgerBtn.classList.toggle('is-active');
        });
    }

    // --- 功能 2: 登出 ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('loggedInUser');
            // 登出後一律返回登入頁
            window.location.href = 'login.html';
        });
    }

    // --- 功能 3: 重新設定偏好 ---
    // 這個按鈕的行為比較特殊，它需要在 login.html 觸發 showPage，在其他頁面則是跳轉
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // 檢查當前頁面是否有 showPage 函式 (代表在 login.html)
            if (typeof showPage === 'function') {
                showPage('style-page');
            } else {
                window.location.href = 'login.html#style-page';
            }
        });
    }

    // --- 功能 4: 顯示使用者名稱 ---
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser && usernameDisplay) {
        const { displayName } = JSON.parse(loggedInUser);
        usernameDisplay.textContent = displayName;
    } else {
        // 如果未登入，確保漢堡按鈕在手機版上依然可見
        // 這裡不需要做任何事，因為 CSS 已經處理了響應式顯示
        // 但保留這個 else 區塊可以讓邏輯更清晰
    }

    // --- 執行特定頁面的初始化函式 ---
    if (typeof initializeDailyPage === 'function') {
        initializeDailyPage();
    }
}