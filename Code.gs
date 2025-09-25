/**
 * @fileoverview Backend for Smart Kitchen Web App.
 * Handles user authentication, data storage in Google Sheets,
 * and interaction with the Gemini AI API.
 */

// --- GLOBAL CONFIGURATION ---
const HOME_SHEET_ID = '1bPmwKtm6Ak8mnS1ssIcE9VK2hNnMuFF-EWcu6ANRXVw'; // 主控使用者資料的 Sheet ID
const TARGET_FOLDER_ID = '1GxENSoBnnCI8ecFoSf-CNshPpvnS1SoP'; // 您指定的 Google Drive 資料夾 ID
const USERS_SHEET_NAME = '使用者資料'; // 修正：將工作表名稱更新為 "使用者資料"

/**
 * Main entry point for all POST requests from the web app.
 * Acts as a router to delegate tasks based on the 'action' parameter.
 * @param {object} e The event parameter from the web app POST request.
 * @returns {ContentService.TextOutput} A JSON response.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;

    switch (action) {
      case 'register':
        result = handleRegister(payload);
        break;
      case 'login':
        result = handleLogin(payload);
        break;
      case 'checkIdName':
        result = handleCheckIdName(payload);
        break;
      case 'updateAllergens':
        result = handleUpdatePreferences(payload);
        break;
      case 'getDailyRecommendation':
        result = handleGetDailyRecommendation(payload);
        break;
      case 'analyzeDish':
      case 'createFromIngredients':
      case 'randomRecipe':
      case 'refineRecipe':
        result = handleGetAiRecipe(payload);
        break;
      case 'saveRecipeToSheet':
        result = handleSaveRecipeToSheet(payload.payload);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`Error in doPost: ${error.toString()} \nStack: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- HANDLER FUNCTIONS ---

/**
 * Handles new user registration.
 */
function handleRegister(payload) {
  const { id_name, username, pw } = payload;
  if (!id_name || !username || !pw) {
    throw new Error('註冊資訊不完整。');
  }

  const sheet = getUsersSheet();
  const headers = getHeaders(sheet);
  const idNameCol = headers.indexOf('IDname') + 1;

  if (idNameCol > 0 && findRowByValue(sheet, idNameCol, id_name)) {
    throw new Error('此登入帳號已被註冊。');
  }

  const salt = Utilities.getUuid();
  const pwHash = hashPassword(pw, salt);
  const newId = sheet.getLastRow(); // Simple ID generation

  const newRow = Array(headers.length).fill('');
  newRow[headers.indexOf('ID')] = newId;
  newRow[headers.indexOf('IDname')] = id_name;
  newRow[headers.indexOf('username')] = username;
  newRow[headers.indexOf('PW_HASH')] = pwHash;
  newRow[headers.indexOf('SALT')] = salt;
  newRow[headers.indexOf('Registration time')] = new Date().toLocaleString('sv-SE');

  sheet.appendRow(newRow);

  // Create the user's personal spreadsheet
  createUserSheet(id_name);

  return { status: 'success', message: '註冊成功！' };
}

/**
 * Handles user login.
 */
function handleLogin(payload) {
  const { id_name, pw } = payload;
  const sheet = getUsersSheet();
  const headers = getHeaders(sheet);
  const idNameCol = headers.indexOf('IDname') + 1;

  const userRow = findRowByValue(sheet, idNameCol, id_name);
  if (!userRow) {
    throw new Error('帳號或密碼錯誤。');
  }

  const pwHash = userRow[headers.indexOf('PW_HASH')];
  const salt = userRow[headers.indexOf('SALT')];
  const username = userRow[headers.indexOf('username')];

  if (hashPassword(pw, salt) !== pwHash) {
    throw new Error('帳號或密碼錯誤。');
  }

  return { status: 'success', message: '登入成功', username: username };
}

/**
 * Checks if an ID Name is already taken.
 */
function handleCheckIdName(payload) {
  const { id_name } = payload;
  const sheet = getUsersSheet();
  const headers = getHeaders(sheet);
  const idNameCol = headers.indexOf('IDname') + 1;
  const isAvailable = !findRowByValue(sheet, idNameCol, id_name);
  return { status: 'success', available: isAvailable };
}

/**
 * Updates user's dietary preferences in the main 'home' sheet.
 */
function handleUpdatePreferences(payload) {
  const { id_name, allergens, style } = payload;
  const sheet = getUsersSheet();
  const headers = getHeaders(sheet);
  const idNameCol = headers.indexOf('IDname') + 1;

  const rowIndex = findRowIndexByValue(sheet, idNameCol, id_name);
  if (!rowIndex) {
    throw new Error('找不到該使用者。');
  }

  sheet.getRange(rowIndex, headers.indexOf('allergens') + 1).setValue(allergens);
  sheet.getRange(rowIndex, headers.indexOf('style') + 1).setValue(style);

  return { status: 'success', message: '偏好設定已更新。' };
}

/**
 * Saves a generated recipe to the user's personal spreadsheet.
 */
function handleSaveRecipeToSheet(payload) {
  const { id_name, source, ...recipeData } = payload;

  const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  const files = targetFolder.getFilesByName(id_name);

  if (!files.hasNext()) {
    throw new Error(`找不到使用者 ${id_name} 的專屬食譜庫。`);
  }

  const userSheet = SpreadsheetApp.open(files.next());
  const targetSheet = userSheet.getSheetByName(source);

  if (!targetSheet) {
    throw new Error(`在食譜庫中找不到名為 "${source}" 的分頁。`);
  }

  const date = new Date().toLocaleString('sv-SE');
  const recipeJson = JSON.stringify(recipeData);

  targetSheet.appendRow([date, recipeJson]);

  return { status: 'success', message: '食譜已成功儲存！' };
}

/**
 * Fetches a daily recommendation and saves it.
 */
function handleGetDailyRecommendation(payload) {
    const { id_name } = payload;
    if (!id_name) {
        throw new Error("請求中缺少 'id_name' 參數。");
    }

    const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    const files = targetFolder.getFilesByName(id_name);
    let userSheetFile;

    if (!files.hasNext()) {
        // 如果找不到使用者的 Sheet，立即為他生成一份
        Logger.log(`找不到使用者 ${id_name} 的食譜庫，將即時生成...`);
        const aiResult = generateRecipeForUser(id_name); // 即時生成
        return { status: 'success', data: aiResult }; // 直接回傳新生成的結果
    } else {
        userSheetFile = files.next();
    }

    const userSpreadsheet = SpreadsheetApp.open(userSheetFile);
    const dailySheet = userSpreadsheet.getSheetByName('每日推薦');

    if (!dailySheet || dailySheet.getLastRow() <= 1) {
        // 如果有 Sheet 但沒有每日推薦分頁或沒有任何資料
        Logger.log(`在 ${id_name} 的食譜庫中找不到 '每日推薦' 資料，將即時生成...`);
        const aiResult = generateRecipeForUser(id_name); // 即時生成
        return { status: 'success', data: aiResult }; // 直接回傳新生成的結果
    }

    // 判斷應讀取今天還是昨天的日期
    const now = new Date();
    const targetDate = new Date();
    if (now.getHours() < 7) { // 早上 7 點前，讀取前一天的資料
        targetDate.setDate(targetDate.getDate() - 1);
    }
    const formattedTargetDate = Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

    const data = dailySheet.getDataRange().getValues();
    // 從最後一筆開始找，效率較高
    for (let i = data.length - 1; i > 0; i--) {
        const recordDate = new Date(data[i][0]);
        const formattedRecordDate = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        if (formattedRecordDate === formattedTargetDate) {
            Logger.log(`為 ${id_name} 找到目標日期 ${formattedTargetDate} 的食譜。`);
            return { status: 'success', data: JSON.parse(data[i][1]) };
        }
    }

    // 如果找不到目標日期的食譜，則回傳最新的一筆食譜作為備案
    Logger.log(`在 ${formattedTargetDate} 找不到 ${id_name} 的食譜，回傳最新一筆資料。`);
    return { status: 'success', data: JSON.parse(data[data.length - 1][1]) };
}

/**
 * 為指定使用者即時生成食譜的輔助函式
 */
function generateRecipeForUser(id_name) {
    const preferences = getUserPreferences(id_name);
    const prompt = `請為 ${id_name} 設計一份單人份的健康晚餐食譜。此人偏好 ${preferences.style || '不限'} 風格的料理，請盡量符合此風格。此人對以下食材忌口，請務必完全避開：${preferences.allergens || '無'}。請提供詳細且準確的菜名、所需食材清單(含份量)和非常詳細的烹飪步驟。每個步驟都應該清晰易懂，適合廚房新手，並盡可能包含烹飪時間、火侯大小等細節。請嚴格以 JSON 格式回傳，不要包含任何 JSON 以外的文字或 markdown 標記。JSON 格式如下：{"dishName": "菜名", "ingredients": [{"name": "食材1", "quantity": "份量1"}, {"name": "食材2", "quantity": "份量2"}], "instructions": ["第一個步驟的文字說明，不要包含編號", "第二個步驟的文字說明，不要包含編號"]}`;

    const aiResult = callGeminiAPI(prompt);

    // 將新生成的食譜儲存起來
    try {
        handleSaveRecipeToSheet({
            id_name: id_name,
            source: '每日推薦',
            ...aiResult
        });
        Logger.log(`成功為 ${id_name} 即時生成並儲存食譜。`);
    } catch (saveError) {
        Logger.log(`為 ${id_name} 即時儲存食譜時失敗: ${saveError.message}`);
    }

    return aiResult;
}

/**
 * Generic handler for AI recipe generation actions.
 */
function handleGetAiRecipe(payload) {
  const { id_name, prompt, imageData } = payload;
  const preferences = getUserPreferences(id_name);

  const fullPrompt = `
  使用者的全域飲食偏好設定如下，請將其納入考量：
  - 飲食偏好: ${preferences.style || '不限'}
  - 飲食忌口: ${preferences.allergens || '無'}
  
  ---
  
  以下是使用者的具體要求：
  ${prompt}
  `;

  const aiResult = callGeminiAPI(fullPrompt, imageData);
  return { success: true, data: aiResult };
}

/**
 * Helper function to get the main users sheet with robust error checking.
 */
function getUsersSheet() {
  const ss = SpreadsheetApp.openById(HOME_SHEET_ID);
  if (!ss) {
    throw new Error(`後端錯誤：無法存取主控試算表 (ID: ${HOME_SHEET_ID})。請檢查試算表 ID 是否正確且您有權限存取。`);
  }
  const sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    throw new Error(`後端錯誤：在主控試算表中找不到名為 "${USERS_SHEET_NAME}" 的工作表。`);
  }
  return sheet;
}


// --- UTILITY & HELPER FUNCTIONS ---

/**
 * Creates a new personal spreadsheet for a user in the target folder.
 */
function createUserSheet(id_name) {
  const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  const newSpreadsheet = SpreadsheetApp.create(id_name);
  const file = DriveApp.getFileById(newSpreadsheet.getId());

  // Move the file to the target folder
  targetFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file); // Clean up from root

  // 1. 先新增您需要的四個分頁
  const sheetNames = ["每日推薦", "食材上傳", "料理辨識", "選項推薦"];
  sheetNames.forEach(name => {
    const sheet = newSpreadsheet.insertSheet(name);
    sheet.getRange("A1:B1").setValues([['date', 'dish']]);
  });
}

/**
 * Retrieves a user's preferences from the main sheet.
 */
function getUserPreferences(id_name) {
  const sheet = getUsersSheet();
  const headers = getHeaders(sheet);
  const idNameCol = headers.indexOf('IDname') + 1;
  const userRow = findRowByValue(sheet, idNameCol, id_name);

  if (!userRow) {
    return { allergens: '', style: '' }; // Return default if user not found
  }

  return {
    allergens: userRow[headers.indexOf('allergens')],
    style: userRow[headers.indexOf('style')]
  };
}

/**
 * Calls the Gemini Pro Vision API.
 */
function callGeminiAPI(prompt, imageData) {
  // 警告：直接將 API 金鑰寫在程式碼中可能存在安全風險。建議優先使用「指令碼屬性」來管理。
  const API_KEY = "AIzaSyClyION-kBcA1ZLbQ7PH-xQzoikkXgw1Ak"; // <--- 已更新您的 API 金鑰

  if (!API_KEY || API_KEY === "請在這裡貼上您的Gemini API金鑰") {
    throw new Error("Gemini API 金鑰尚未在 GS 程式碼中設定，請檢查 Code.gs 檔案。");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      "response_mime_type": "application/json",
    }
  };

  if (imageData && imageData.length > 0) {
    imageData.forEach(img => {
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.base64
        }
      });
    });
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const jsonResponse = JSON.parse(responseText);

  if (jsonResponse.error) {
    throw new Error(`Gemini API Error: ${jsonResponse.error.message}`);
  }
  
  const candidate = jsonResponse.candidates && jsonResponse.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
    throw new Error('從 AI 收到的回應格式不正確。');
  }

  // The response from Gemini is a JSON string, so we need to parse it again.
  return JSON.parse(candidate.content.parts[0].text);
}

/**
 * Hashes a password with a given salt.
 */
function hashPassword(password, salt) {
  const toHash = password + salt;
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toHash);
  return hashBytes.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Gets the header row of a sheet.
 */
function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * Finds a row in a sheet by a value in a specific column.
 * @returns {Array|null} The row data if found, otherwise null.
 */
function findRowByValue(sheet, col, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][col - 1].toString() === value.toString()) {
      return data[i];
    }
  }
  return null;
}

/**
 * Finds the row index in a sheet by a value in a specific column.
 * @returns {number|null} The row index (1-based) if found, otherwise null.
 */
function findRowIndexByValue(sheet, col, value) {
  const data = sheet.getRange(1, col, sheet.getLastRow()).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toString() === value.toString()) {
      return i + 1; // Return 1-based index
    }
  }
  return null;
}