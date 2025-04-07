// Контент-скрипт для WB Аналитика
// Запускается на страницах wildberries.ru

// Функция для извлечения артикула из URL
function extractArticleFromUrl(url) {
  // Паттерн для поиска артикула в URL WB
  const patterns = [
    /\/catalog\/(\d+)\/detail\.aspx/i,  // Старый формат URL
    /\/product\/(\d+)\/detail/i,        // Новый формат URL
    /\/product\/(\d+)/i                 // Самый новый формат URL
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Определяем функцию для передачи артикула в расширение, но без отображения кнопки
// Эта функция может быть использована в будущем, если решим добавить другой способ взаимодействия
function getArticleData() {
  const articleId = extractArticleFromUrl(window.location.href);
  if (articleId) {
    chrome.runtime.sendMessage({ 
      action: 'getArticleFromPage', 
      articleId 
    });
  }
} 