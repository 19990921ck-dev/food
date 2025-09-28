# 系統架構書：使用者註冊與飲食偏好系統

本文檔旨在說明一個包含使用者註冊、登入、密碼找回及飲食偏好設定功能的系統架構。

---

## 1. 系統概述

本系統旨在提供一個完整的使用者身份驗證流程，並在使用者首次註冊成功後，引導其設定個人的飲食忌口（過敏原）。系統後端資料將儲存於 Google Sheets，並透過 Google Apps Script 作為 API 進行資料交換。

### 1.1. 核心功能

- **新使用者註冊**：提供註冊介面，驗證使用者名稱的唯一性。
- **舊使用者登入**：驗證使用者憑證，並導向主頁面。
- **飲食忌口 (含過敏原) 設定**：註冊成功後，引導使用者進入設定頁面，選擇個人的過敏原與其他飲食禁忌。
- **使用者回饋**：在所有等待伺服器回應的操作中顯示 "LOADING" 提示，並在操作失敗時提供明確的錯誤訊息。

---

## 2. 使用者流程 (User Flow)

```mermaid
graph TD
    A[使用者進入應用] --> B{已有帳號?};
    B -- 否 --> C[註冊頁面];
    B -- 是 --> D[登入頁面];

    C --> E{填寫註冊資料 (IDname, USERNAME, PW)};
    E -- 提交 --> F[系統處理中 (顯示LOADING)];
    F --> G{註冊成功?};
    G -- 是 --> H[跳轉至飲食忌口(含過敏原)設定頁面];
    G -- 否 (例如: ID NAME已存在) --> I[顯示錯誤提示];
    I --> C;

    D --> J{填寫登入資料};
    J -- 提交 --> K[系統處理中 (顯示LOADING)];
    K --> L{登入成功?};
    L -- 是 --> M[跳轉至應用主頁面];
    L -- 否 (例如: 密碼錯誤) --> N[顯示錯誤提示];
    N --> D;
    D -- 點擊忘記密碼 --> O[忘記密碼頁面];

    H --> P{選擇過敏原};
    P -- 完成 --> Q[系統儲存設定 (顯示LOADING)];
    Q --> M;
```

---

## 3. 前端介面需求

### 3.1. 註冊頁面
- **輸入欄位**：
  - `IDname` (登入帳號)：提示「只能使用英文，區分大小寫，上限12個字」。
  - `USERNAME` (系統稱呼)：使用者希望系統如何稱呼自己。
  - `PW` (密碼)：長度至少8碼，且必須包含大小寫英文字母及數字。
  - `確認密碼`：驗證兩次密碼輸入是否一致。
- **錯誤提示**：
  - 當 `IDname` 已被註冊時，提示「此登入帳號已被使用，請更換」。
  - 當 `IDname` 已被註冊時，提示「此登入帳號已被使用，請更換」。
  - 其他註冊失敗情況，提示「註冊失敗，請稍後再試」。

### 3.2. 登入頁面
- **輸入欄位**：
  - `IDname` (登入帳號)
  - `PW` (密碼)
- **連結**：
  - 「忘記密碼？」
- **錯誤提示**：
  - 當驗證失敗時，提示「登入帳號或密碼錯誤」。

### 3.3. 飲食忌口 (含過敏原) 設定頁面
- 此頁面在使用者**首次**註冊成功後顯示。
- 以多選框（Checkboxes）或標籤（Tags）形式列出常見的**過敏原**與其他**飲食禁忌**項目（例如：花生、海鮮、奶製品、麩質、不吃牛、素食等）。
- 使用者選擇完畢後，點擊「完成」按鈕，將資料送出。

### 3.4. 狀態提示
- 所有需要與後端（Google Apps Script）進行通訊的操作（如註冊、登入、儲存飲食忌口），在等待回應期間，介面應顯示 `LOADING...` 狀態，並暫時禁用提交按鈕，防止重複提交。

---

## 4. 後端與資料庫

### 4.1. 技術選型
- **資料庫**: Google Sheets
- **API層**: Google Apps Script
- **Google Sheet ID**: `1bPmwKtm6Ak8mnS1ssIcE9VK2hNnMuFF-EWcu6ANRXVw`

### 4.2. Google Sheet 資料表結構

資料表應包含以下欄位：

| 欄位名稱          | 資料類型 | 說明                                                                                             |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `ID`              | Number   | **主鍵 (Primary Key)**。由系統自動生成的唯一數字編號，從 1 開始，按註冊順序遞增。                  |
| `IDname`          | String   | **唯一值**。使用者自訂的**登入帳號**。限制為英文、區分大小寫、上限12個字。                 |
| `USERNAME`        | String   | 使用者希望系統使用的**稱呼**。在註冊時填寫。                                                     |
| `PW`              | String   | 使用者密碼。**強烈建議**在儲存前進行雜湊 (Hashing) 加密，不要儲存明文密碼。                      |
| `allergens`       | String   | 使用者選擇的過敏原。可使用逗號分隔的字串儲存，例如 `"花生,海鮮,芒果"`。在使用者填寫完畢後更新此欄位。 |
| `Registration time` | DateTime | 使用者註冊成功的時間戳。格式建議為 `YYYY-MM-DD HH:mm:ss`。                                       |

### 4.3. Google Apps Script API 端點 (Endpoints)

應建立一個部署為 Web App 的 Google Apps Script 專案，並提供以下功能的函式：

- `doPost(e)`: 作為主要的請求處理函式。
  - **`action: 'register'`**:
    - 接收 `id_name`, `username`, 和 `pw`。
    - 檢查 `id_name` 是否已存在。若存在，回傳錯誤。
    - 若不存在，計算新的 `ID`，記錄 `Registration time`，將新使用者資料寫入 Google Sheet，並回傳成功訊息。
  - **`action: 'login'`**:
    - 接收 `id_name` 和 `pw`。
    - 查找 `id_name` 並比對 `pw` (雜湊值)。
    - 驗證成功則回傳成功訊息；失敗則回傳錯誤。
  - **`action: 'updateAllergens'`**:
    - 接收 `id_name` 和 `allergens` 字串。
    - 找到對應的使用者，並更新其 `allergens` 欄位。

---

## 5. Gemini API 整合 (可選功能)

系統可整合 Google Gemini API 來提供智慧化功能，例如根據使用者的過敏原推薦食譜或提供飲食建議。

### 5.1. API 金鑰管理

**警告：切勿將您的 API 金鑰直接寫在前端程式碼中。**

您的 Gemini API 金鑰 (`AIza...`) 應作為環境變數或在安全的後端環境中管理。如果必須在前端呼叫，建議透過一層您自己的後端服務（例如 Google Apps Script）來代理 API 請求，以隱藏金鑰。

### 5.2. 呼叫範例 (JavaScript)

以下是在 JavaScript 環境中呼叫 Gemini API 的範例程式碼。

```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

// 注意：請從安全的伺服器端環境變數中讀取您的 API 金鑰
// 不要在前端程式碼中直接暴露金鑰
const API_KEY = "AIzaSyBY0AZvBhP9ZMVTk5preI7DKlkYAHec-BY";

const genAI = new GoogleGenerativeAI(API_KEY);

async function getDietaryAdvice(promptText) {
  // 選擇模型
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(promptText);
  const response = await result.response;
  const text = response.text();
  console.log(text);
  return text;
}

// 範例呼叫
// const userAllergens = "花生,海鮮";
// getDietaryAdvice(`我對 ${userAllergens} 過敏，請給我一些早餐建議。`);
```
