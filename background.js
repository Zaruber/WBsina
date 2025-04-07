// Фоновый скрипт для WB Аналитика

// Прослушиваем установку расширения
chrome.runtime.onInstalled.addListener(() => {
  console.log('Расширение "WB Аналитика" успешно установлено');
  
  // Инициализируем хранилище, если оно еще не создано
  chrome.storage.local.get('savedProducts', (result) => {
    if (!result.savedProducts) {
      chrome.storage.local.set({ savedProducts: [] });
    }
  });
});

// Временная переменная для хранения последнего артикула, обнаруженного на странице
let lastDetectedArticle = null;

// Отлавливаем сообщения от контент-скрипта
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getArticleFromPage') {
    // Сохраняем артикул, полученный со страницы
    lastDetectedArticle = request.articleId;
    console.log('Получен артикул с сайта WB:', lastDetectedArticle);
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getLastDetectedArticle') {
    // Возвращаем последний обнаруженный артикул для popup
    sendResponse({ articleId: lastDetectedArticle });
    return true;
  }
});

// Функция для открытия расширения при клике на иконку в браузере
chrome.action.onClicked.addListener((tab) => {
  chrome.action.openPopup();
}); 