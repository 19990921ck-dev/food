/**
 * 專案設定檔
 * 請將 GAS_WEB_APP_URL 替換為您部署的 Google Apps Script Web App URL。
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxcA3RmGprVQgjQFwl56DIpgKNTMP826qxAKv5cg__tfVL47gm7VzFi51y0Gg1TWaVJuA/exec';

/**
 * 網站的根路徑。
 * - 如果您的網站是部署在 `https://<user>.github.io/<repo>/`，請設定為 `/<repo>/`。
 * - 如果是部署在根目錄 `https://example.com/`，請設定為 `/`。
 * - 如果是在本地端直接開啟檔案，請設定為空字串 `''`。
 */
const BASE_PATH = '/food/'; // 在本地端測試時，請留空。部署到 GitHub Pages 時，請改為您的專案名稱，例如 '/my-project/'
