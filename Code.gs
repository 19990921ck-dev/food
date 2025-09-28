/**
 * @fileoverview Backend for Smart Kitchen Web App.
 * Handles user authentication, data storage in Google Sheets,
 * and interaction with the Gemini AI API.
 */

// --- GLOBAL CONFIGURATION ---
const HOME_SHEET_ID = '1bPmwKtm6Ak8mnS1ssIcE9VK2hNnMuFF-EWcu6ANRXVw'; // 主控使用者資料的 Sheet ID
const TARGET_FOLDER_ID = '1GxENSoBnnCI8ecFoSf-CNshPpvnS1SoP'; // 您指定的 Google Drive 資料夾 ID
const USERS_SHEET_NAME = '使用者資料'; // 與 README.md 保持一致

/**
 * Main entry point for all POST requests from the web app.
 * Acts as a router to delegate tasks based on the 'action' parameter.
 * @param {object} e The event parameter from the web app POST request.
 * @returns {ContentService.TextOutput} A JSON response.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action } = payload;
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
      case 'getUserPreferences':
        result = { status: 'success', data: getUserPreferences(payload.id_name) };
        break;
      case 'getHistory':
        result = handleGetHistory(payload);
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
  const newId = sheet.getLastRow(); // 簡易 ID 生成，注意：若有刪除列，此方法可能導致 ID 重複

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
 * Handles fetching historical records for a user from a specific source sheet.
 */
function handleGetHistory(payload) {
  const { id_name, source } = payload;
  if (!id_name || !source) {
    throw new Error("請求中缺少 'id_name' 或 'source' 參數。");
  }

  const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  const files = targetFolder.getFilesByName(id_name);

  if (!files.hasNext()) {
    throw new Error(`找不到使用者 ${id_name} 的專屬食譜庫。`);
  }

  const userSheet = SpreadsheetApp.open(files.next());
  const sourceSheet = userSheet.getSheetByName(source);

  if (!sourceSheet || sourceSheet.getLastRow() <= 1) {
    return { status: 'success', data: [] }; // 沒有分頁或沒有資料，回傳空陣列
  }

  const data = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, 2).getValues();
  const history = data.map(row => {
    const recipeData = JSON.parse(row[1]);
    return {
      date: row[0],
      dishName: recipeData.dishName, // 為了方便前端顯示，將菜名提取出來
      recipe: recipeData // 保留完整的食譜物件
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date)); // 依日期降冪排序

  return { status: 'success', data: history };
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
    // 【關鍵修正】: 如果找不到目標日期的食譜，則生成一份新的
    Logger.log(`在 ${formattedTargetDate} 找不到 ${id_name} 的食譜，將即時生成一份。`);
    return { status: 'success', data: generateRecipeForUser(id_name) };
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
  const { id_name, prompt, imageData, action } = payload;
  const preferences = getUserPreferences(id_name);
  let conflictMessage = null;

  // 僅在 "食材上傳" 流程中進行衝突檢測
  if (action === 'createFromIngredients' && imageData && imageData.length > 0) {
    const userAllergens = preferences.allergens ? preferences.allergens.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (userAllergens.length > 0) {
      // 步驟 1: 讓 AI 辨識圖片中的主要食材
      const identificationPrompt = "請辨識這張圖片中的主要食材是什麼，請只回傳食材的中文名稱，用逗號分隔，例如：'豬肉, 青椒, 洋蔥'。";
      try {
        const identifiedIngredientsText = callGeminiAPI(identificationPrompt, imageData, true); // true 表示這是純文字回應
        const identifiedIngredients = identifiedIngredientsText.split(',').map(s => s.trim());

        // 步驟 2: 比對忌口清單
        const conflicts = identifiedIngredients.filter(ingredient => userAllergens.some(allergen => ingredient.includes(allergen)));
        
        if (conflicts.length > 0) {
          conflictMessage = `提醒：您上傳的食材中可能包含「${conflicts.join(', ')}」，這與您設定的忌口偏好衝突，請多加注意。`;
        }
      } catch (e) {
        Logger.log(`在食材上傳流程中，辨識食材時發生錯誤: ${e.message}`);
        // 辨識失敗不中斷流程，繼續生成食譜
      }
    }
  }

  const fullPrompt = `
  使用者的全域飲食偏好設定如下，請將其納入考量：
  - 飲食偏好: ${preferences.style || '不限'}
  - 飲食忌口: ${preferences.allergens || '無'}
  
  ---
  
  以下是使用者的具體要求：
  ${prompt}
  `;

  const aiResult = callGeminiAPI(fullPrompt, imageData);
  // 將食譜結果和衝突訊息一起回傳
  return { status: 'success', data: aiResult, conflict: conflictMessage };
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
    throw new Error(`後端錯誤：在主控試算表中找不到名為 "${USERS_SHEET_NAME}" 的工作表。請檢查工作表名稱是否正確。`);
  }
  return sheet;
}


// --- UTILITY & HELPER FUNCTIONS ---

/**
 * Creates a new personal spreadsheet for a user in the target folder.
 */
function createUserSheet(id_name) {
  const newSpreadsheet = SpreadsheetApp.create(id_name);
  const file = DriveApp.getFileById(newSpreadsheet.getId());

  // Move the file to the target folder
  const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  targetFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file); // Clean up from root

  // 刪除預設的工作表 "Sheet1"
  const defaultSheet = newSpreadsheet.getSheetByName('Sheet1');
  if (defaultSheet) newSpreadsheet.deleteSheet(defaultSheet);

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
function callGeminiAPI(prompt, imageData, isTextOnlyResponse = false) {
  // 警告：直接將 API 金鑰寫在程式碼中會增加外洩風險。您已確認了解此風險。
  const API_KEY = "AIzaSyDHZREK9pI8jtOrHe78Z2JHjXhx95bQUQY";

  if (!API_KEY) {
    throw new Error("後端錯誤：Gemini API 金鑰尚未在 GS 程式碼中設定。");
  }

  // 【關鍵修正】: 使用 v1beta 端點搭配官方最新的 gemini-1.5-flash 模型，以支援圖片分析。
  // 請務必確認您已在 Google Cloud Console 中為您的專案啟用了 "Vertex AI API"。
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
    ]
  };

  // 如果有圖片資料，將其加入到請求中
  if (imageData && imageData.length > 0) {
    imageData.forEach(img => {
      requestBody.contents[0].parts.push({
        inline_data: { mime_type: img.mimeType, data: img.base64 }
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
  const responseCode = response.getResponseCode();

  if (responseCode === 200) {
    try {
      const result = JSON.parse(responseText);
      if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0].text) {
        let jsonText = result.candidates[0].content.parts[0].text;
        
        // 【關鍵修正】: 清理 Gemini 回應中可能包含的 Markdown 標記
        // 使用正規表示式尋找被 ``` 包圍的 JSON 內容
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0]; // 只取出 JSON 物件的部分
        }

        if (isTextOnlyResponse) {
          return jsonText; // 如果只需要純文字，直接回傳
        } else {
          return JSON.parse(jsonText); // 否則解析為 JSON 物件
        }
      } else {
        throw new Error("Gemini 回應格式無效: " + responseText);
      }
    } catch (e) {
      throw new Error("解析 Gemini 回應失敗: " + e.message + ". 原始回應: " + responseText);
    }
  } else {
    throw new Error(`Gemini API 錯誤: ${responseCode} - ${responseText}`);
  }
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
