/**
 * =================================
 * Smart Kitchen - Main Application Script
 * =================================
 * This file bundles common functionalities for the web app,
 * including header injection and common interactive features.
 */

/**
 * Injects the shared header HTML into the placeholder element.
 */
function initializeHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header id="app-header" class="app-header sticky-top">
                <nav class="navbar">
                    <div class="container-fluid">
                        <a class="navbar-brand" href="login.html">
                            <i class="fa-solid fa-utensils"></i>
                            <span>智慧餐廚</span>
                        </a>
                        <div class="d-flex align-items-center ms-auto">
                            <span id="header-username" class="user-display me-2">尚未登入</span>
                            <button class="hamburger-button" aria-label="Toggle Navigation">
                                <span></span>
                            </button>
                        </div>
                    </div>
                </nav>
                <nav id="navigation-menu" class="navigation-menu">
                    <a id="common-reset-settings-btn" href="#">重新設定偏好及忌口</a>
                    <hr>
                    <a id="common-logout-btn" href="#" class="text-danger">登出</a>
                </nav>
            </header>
        `;
    }
}

/**
 * Initializes common interactive features like menu, logout, etc.
 * This should be called after the header is initialized.
 */
function initializeCommonFeatures() {
    const hamburgerBtn = document.querySelector('.hamburger-button');
    const navMenu = document.querySelector('.navigation-menu');
    const logoutBtn = document.getElementById('common-logout-btn');
    const resetSettingsBtn = document.getElementById('common-reset-settings-btn');
    const usernameDisplay = document.getElementById('header-username');

    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('is-active');
            hamburgerBtn.classList.toggle('is-active');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('loggedInUser');
            window.location.href = 'login.html';
        });
    }

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof showPage === 'function') {
                showPage('style-page');
            } else {
                window.location.href = 'login.html#style-page';
            }
        });
    }

    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser && usernameDisplay) {
        const { displayName } = JSON.parse(loggedInUser);
        usernameDisplay.textContent = displayName;
    }

    if (typeof initializeDailyPage === 'function') {
        initializeDailyPage();
    }

    // 檢查是否有特定頁面的初始化函式，若有則執行
    if (typeof initializePageSpecificFeatures === 'function') {
        initializePageSpecificFeatures();
    }
}

/**
 * 呼叫後端 Google Apps Script API 的共用函式
 * @param {string} action - 要執行的動作名稱
 * @param {object} payload - 要傳送的資料
 * @param {string|null} loadingText - 讀取期間要顯示的文字，傳入 null 則不改變
 * @returns {Promise<object|null>} - 成功時返回結果物件，失敗時返回 null
 */
async function callGasApi(action, payload, loadingText = null) {
    // 假設 loadingOverlay 存在於所有頁面
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTextElement = loadingOverlay ? loadingOverlay.querySelector('p') : null;

    if (loadingOverlay) {
        if (loadingText && loadingTextElement) loadingTextElement.textContent = loadingText;
        loadingOverlay.style.display = 'flex';
    }

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...payload })
        });

        if (!response.ok) {
            throw new Error(`伺服器錯誤: ${response.statusText}`);
        }

        const result = await response.json();

        // 兼容 'status' 和 'success' 兩種成功標誌
        if (result.status === 'success' || result.success === true) {
            return result;
        } else {
            throw new Error(result.message || '發生未知錯誤');
        }
    } catch (error) {
        console.error('API Call Failed:', error);
        alert(`操作失敗：${error.message}`); // 使用 alert 作為通用錯誤提示
        return null;
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    initializeHeader();
    initializeCommonFeatures();
});