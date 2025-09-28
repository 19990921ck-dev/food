/**
 * =================================
 * Smart Kitchen - Main Application Script
 * =================================
 * This file is the single source of truth for all shared functionalities,
 * including header injection, API calls, and common interactive features.
 */
 
/**
 * Injects the shared header HTML into the placeholder element.
 */
function initializeHeader() {
    // 修正：根據 config.js 中的 BASE_PATH 決定連結路徑
    const homeUrl = (typeof BASE_PATH !== 'undefined' && BASE_PATH) ? `${BASE_PATH}index.html` : 'index.html';

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header id="app-header" class="app-header sticky-top">
                <nav class="navbar navbar-expand">
                    <div class="container-fluid">
                        <a class="navbar-brand" href="${homeUrl}">
                            <i class="fa-solid fa-utensils"></i>
                            <span>今日食光</span>
                        </a>
                        <div class="d-flex align-items-center ms-auto">
                            <span id="header-username" class="user-display me-2">尚未登入</span>
                            <button class="hamburger-button" type="button" aria-label="Toggle Navigation">
                                <span></span>
                            </button>
                        </div>
                    </div>
                </nav>
                <nav id="navigation-menu" class="navigation-menu ">
                    <a id="common-daily-recommendation-btn" href="#">每日推薦</a>
                    <a href="Ingredient_upload.html">食材辨識</a>
                    <a href="identification.html">料理辨識</a>
                    <a href="options.html">選項推薦</a>
                    <a id="common-history-btn" href="#">歷史紀錄</a>
                    <a id="common-reset-settings-btn" href="#">重新設定偏好及忌口</a>
                    <hr class="my-2">
                    <a id="common-logout-btn" href="#" class="text-danger">登出</a>
                </nav>
            </header>
        `;
    }
}

/**
 * Updates the username display in the header based on localStorage.
 * Can be called anytime to refresh the username.
 */
function updateHeaderUsername() {
    // 獲取需要控制顯示/隱藏的導覽選單項目
    const usernameDisplay = document.getElementById('header-username');
    const resetSettingsBtn = document.getElementById('common-reset-settings-btn');
    const logoutBtn = document.getElementById('common-logout-btn');
    // 取得所有需要登入才能顯示的選單項目
    const menuItems = document.querySelectorAll('.navigation-menu a:not(#common-logout-btn), .navigation-menu hr');
    const menuSeparator = document.querySelector('.navigation-menu hr');

    const loggedInUser = localStorage.getItem('loggedInUser');

    if (loggedInUser && usernameDisplay) {
        try {
            const { displayName } = JSON.parse(loggedInUser);
            usernameDisplay.textContent = displayName;
            // 登入狀態：顯示選項
            menuItems.forEach(item => {
                // 確保登出按鈕永遠可見 (如果邏輯需要)
                if (item.id !== 'common-logout-btn') {
                    item.style.display = '';
                }
            });
            if (logoutBtn) logoutBtn.style.display = '';

        } catch (e) {
            console.error("Failed to parse user data for header update:", e);
            usernameDisplay.textContent = '資料錯誤';
        }
    } else if (usernameDisplay && resetSettingsBtn && logoutBtn && menuSeparator) {
        usernameDisplay.textContent = '尚未登入';
        // 未登入狀態：隱藏選項
        menuItems.forEach(item => {
            if (item.id !== 'common-logout-btn') {
                item.style.display = 'none';
            }
        });
    }
}

/**
 * Initializes common interactive features like menu, logout, etc.
 * This should be called after the header is initialized.
 */
function initializeCommonFeatures() {
    // --- Element Selection ---
    const hamburgerBtn = document.querySelector('.hamburger-button');
    const navMenu = document.querySelector('.navigation-menu');
    const logoutBtn = document.getElementById('common-logout-btn');
    const resetSettingsBtn = document.getElementById('common-reset-settings-btn');
    const dailyBtn = document.getElementById('common-daily-recommendation-btn');
    const historyBtn = document.getElementById('common-history-btn');
    const usernameDisplay = document.getElementById('header-username');

    if (hamburgerBtn && navMenu) {
        // --- Feature 1: Hamburger Menu Toggle ---
        hamburgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('is-active');
            hamburgerBtn.classList.toggle('is-active');
        });
    }

    if (logoutBtn) {
        // --- Feature 2: Logout ---
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('loggedInUser');
            updateHeaderUsername();
            // 修正：使用動態產生的 homeUrl 進行跳轉
            const homeUrl = (typeof BASE_PATH !== 'undefined' && BASE_PATH) ? `${BASE_PATH}index.html` : 'index.html';
            window.location.href = homeUrl;
        });
    }

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 判斷當前是否在 index.html
            const isIndexPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html');

            if (isIndexPage && typeof window.showPage === 'function') {
                // 如果在 index.html 且 showPage 函式存在，直接呼叫函式切換頁面，避免重整
                window.showPage('style-page');
            } else {
                // 如果在其他頁面，則跳轉回 index.html 的設定頁
                const homeUrl = (typeof BASE_PATH !== 'undefined' && BASE_PATH) ? `${BASE_PATH}index.html` : 'index.html';
                window.location.href = `${homeUrl}#style-page`;
            }
        });
    }
 
    // --- Feature 4: Daily Recommendation Link ---
    if (dailyBtn) {
        dailyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
            if (user && user.idName) {
                window.location.href = `day.html?user=${encodeURIComponent(user.idName)}`;
            } else {
                alert('無法識別使用者，請重新登入。');
            }
        });
    }

    // --- Feature 5: History Link ---
    if (historyBtn) {
        historyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isIndexPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html');

            if (isIndexPage && typeof window.showPage === 'function') {
                // 如果在 index.html，直接呼叫函式切換
                window.showPage('history-source-selection-page');
            } else {
                // 如果在其他頁面，跳轉回 index.html 的歷史紀錄頁
                const homeUrl = (typeof BASE_PATH !== 'undefined' && BASE_PATH) ? `${BASE_PATH}index.html` : 'index.html';
                window.location.href = `${homeUrl}#history-source-selection-page`;
            }
        });
    }

    // 修正: 確保在 index.html 頁面，點擊 hash 連結時能正確觸發 showPage
    if (window.location.hash && window.location.pathname.includes('index.html')) {
        const pageId = window.location.hash.substring(1);
        if (document.getElementById(pageId) && typeof window.showPage === 'function') {
            window.showPage(pageId);
        }
    }

    // Initial update of the username on page load
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
        if (loadingTextElement) {
            // Use default text if loadingText is not provided
            loadingTextElement.textContent = loadingText || '處理中，請稍候...';
        }
        loadingOverlay.style.display = 'flex'; // Use 'flex' to center content
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

        // Check for a success status from the backend
        if (result.status === 'success') {
            return result;
        } else {
            // If the backend reports an error, throw it to be caught below
            throw new Error(result.message || '發生未知錯誤');
        }
    } catch (error) {
        console.error('API Call Failed:', error);
        // Use a more generic alert for user-facing errors
        alert(`操作失敗：${error.message}`);
        return null;
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    initializeHeader();
    updateHeaderUsername(); // Update username as soon as header is ready
 
    // Check for and execute page-specific initialization functions
    if (typeof initializePage === 'function') {
        initializePage();
    }
 
    // Initialize all common interactive elements
    initializeCommonFeatures();
});

