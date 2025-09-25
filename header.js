document.addEventListener('DOMContentLoaded', () => {
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
});