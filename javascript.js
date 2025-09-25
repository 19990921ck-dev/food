document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-recipe-btn');
    const idnameInput = document.getElementById('idname-input');
    const recipeForm = document.getElementById('recipe-form'); // 假設按鈕和輸入框在一個 form 裡
    const recipeContainer = document.getElementById('recipe-container');
    const recipeContent = document.getElementById('recipe-content');
    const loadingIndicator = document.getElementById('loading');
    const errorDisplay = document.getElementById('error');

    // **重要**: 請將此 URL 替換為您部署 GAS Web App 後得到的 URL
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxBvhusGM0b1obu_PxiF5XkqYCrw7JOJHtCuzyBPkXtvOPbgZEoBWQuE5xkoamAUBoKtA/exec';

    // 使用 form 的 submit 事件來處理，可以同時處理按鈕點擊和 Enter 鍵
    // 需要在 HTML 中將 input 和 button 包在 <form id="recipe-form"> 內
    if (recipeForm) {
        recipeForm.addEventListener('submit', handleFormSubmit);
    } else { // 如果沒有 form，保留原來的事件監聽
        fetchBtn.addEventListener('click', handleFormSubmit);
        idnameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleFormSubmit(e);
            }
        });
    }

    async function handleFormSubmit(event) {
        event.preventDefault(); // 防止表單提交導致頁面刷新
        const idname = idnameInput.value.trim();
        if (!idname) {
            alert('請輸入 IDname！');
            return;
        }

        setLoadingState(true);

        try {
            const data = await fetchRecipeFromAPI(idname);
            renderRecipe(data);
        } catch (err) {
            renderError(err.message);
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        // 根據 isLoading 狀態更新 UI
        fetchBtn.disabled = isLoading;
        idnameInput.disabled = isLoading;
        loadingIndicator.classList.toggle('hidden', !isLoading);

        // 開始載入時，隱藏舊內容和錯誤
        if (isLoading) {
            recipeContainer.classList.remove('hidden');
            recipeContent.classList.add('hidden');
            errorDisplay.classList.add('hidden');
        }
    }

    async function fetchRecipeFromAPI(idname) {
        const url = `${GAS_WEB_APP_URL}?idname=${encodeURIComponent(idname)}`;
        const response = await fetch(url, { mode: 'cors' });

        if (!response.ok) {
            throw new Error(`HTTP 錯誤！ 狀態: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data;
    }

    function renderRecipe(data) {
        document.getElementById('dish-name').textContent = data.recipe.dishName;
        document.getElementById('recipe-date').textContent = data.date;
        document.getElementById('ingredients-list').innerHTML = data.recipe.ingredients.map(item => `<li>${item.name} - ${item.quantity}</li>`).join('');
        document.getElementById('instructions-list').innerHTML = data.recipe.instructions.map(step => `<li>${step}</li>`).join('');
        recipeContainer.classList.remove('hidden');
        recipeContent.classList.remove('hidden');
    }

    function renderError(message) {
        errorDisplay.textContent = `查詢失敗：${message}`;
        errorDisplay.classList.remove('hidden');
    }
});