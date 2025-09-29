/**
 * 專案設定檔
 * 請將 GAS_WEB_APP_URL 替換為您部署的 Google Apps Script Web App URL。
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbziEoocYfV8j4kcw3jqQ07vvEO6cmOIug2L_dqIU0I4t_ukgKDyU9VZjVoymYFnJCXChw/exec';

/**
 * 網站的根路徑。
 * - 如果您的網站是部署在 `https://<user>.github.io/<repo>/`，請設定為 `/<repo>/`。
 * - 如果是部署在根目錄 `https://example.com/`，請設定為 `/`。
 * - 如果是在本地端直接開啟檔案，請設定為空字串 `''`。
 */
const BASE_PATH = ''; // 在本地端測試時，請留空。部署到 GitHub Pages 時，請改為您的專案名稱，例如 '/my-project/'

/**
 * ===================================================================================
 * !! 自動路徑偵測 - 請勿修改以下程式碼 !!
 * 這段程式碼會自動判斷當前環境 (本地端 vs. 網頁伺服器) 並設定正確的資源路徑。
 * ===================================================================================
 */
if (window.location.protocol.startsWith('http')) {
    // 如果是在網頁伺服器上 (http 或 https)
    const path = window.location.pathname;
    const basePath = path.substring(0, path.lastIndexOf('/') + 1);
    document.querySelector('head').insertAdjacentHTML('afterbegin', `<base href="${basePath}">`);
}
