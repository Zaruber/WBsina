document.addEventListener('DOMContentLoaded', () => {
  const articleInput = document.getElementById('articleInput');
  const searchBtn = document.getElementById('searchBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const productInfo = document.getElementById('productInfo');
  const errorMessage = document.getElementById('errorMessage');
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const addToFavoritesBtn = document.getElementById('addToFavoritesBtn');

  // Элементы информации о товаре
  const productImage = document.getElementById('productImage');
  const productName = document.getElementById('productName');
  const productBrand = document.getElementById('productBrand');
  const productSeller = document.getElementById('productSeller');
  const productPrice = document.getElementById('productPrice');
  const productDiscount = document.getElementById('productDiscount');
  const productRating = document.getElementById('productRating');
  const productFeedbacks = document.getElementById('productFeedbacks');
  const warehouseDistribution = document.getElementById('warehouseDistribution');
  const logisticsInfo = document.getElementById('logisticsInfo');
  
  // Элементы для работы с меню
  const menuItems = document.querySelectorAll('.main-menu li');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Элементы для работы со списком складов
  const warehouseSearch = document.getElementById('warehouseSearch');
  const warehouseSort = document.getElementById('warehouseSort');
  const filterFBW = document.getElementById('filterFBW');
  const filterFBS = document.getElementById('filterFBS');
  const warehouseList = document.getElementById('warehouseList');
  
  // Элементы для работы с избранным
  const favoritesList = document.getElementById('favoritesList');
  const favoritesSearch = document.getElementById('favoritesSearch');
  const noFavorites = document.getElementById('noFavorites');

  // Инициализация обработчиков для сворачиваемых блоков
  initCollapsibleSections();
  
  // История цен и позиции
  let priceHistory = [];
  let currentProductData = null;
  // Избранные товары
  let favoriteProducts = [];

  // Загрузка избранных товаров при запуске
  loadFavorites();

  // Переключение между вкладками
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Удаляем активный класс у всех элементов меню
      menuItems.forEach(i => i.classList.remove('active'));
      
      // Добавляем активный класс текущему элементу
      item.classList.add('active');
      
      // Получаем ID вкладки, на которую нужно переключиться
      const tabId = item.getAttribute('data-tab');
      
      // Скрываем все вкладки
      tabContents.forEach(tab => tab.classList.remove('active'));
      
      // Показываем нужную вкладку
      document.getElementById(tabId).classList.add('active');
      
      // Если выбрана вкладка складов, загружаем информацию о складах
      if (tabId === 'warehouse-tab') {
        displayWarehouseData();
      }
      
      // Если выбрана вкладка избранного, загружаем избранные товары
      if (tabId === 'favorites-tab') {
        displayFavorites();
      }
    });
  });

  // Обработчик для кнопки поиска
  searchBtn.addEventListener('click', () => {
    const articleNumber = articleInput.value.trim();
    if (articleNumber) {
      searchProduct(articleNumber);
    }
  });

  // Обработчик для поля ввода (поиск по нажатию Enter)
  articleInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const articleNumber = articleInput.value.trim();
      if (articleNumber) {
        searchProduct(articleNumber);
      }
    }
  });

  // Обработчик для поиска складов
  warehouseSearch.addEventListener('input', () => {
    displayWarehouseData();
  });

  // Обработчик для сортировки складов
  warehouseSort.addEventListener('change', () => {
    displayWarehouseData();
  });

  // Обработчики для фильтров типов складов
  filterFBW.addEventListener('change', () => {
    displayWarehouseData();
  });

  filterFBS.addEventListener('change', () => {
    displayWarehouseData();
  });
  
  // Обработчик поиска в избранном
  favoritesSearch.addEventListener('input', () => {
    displayFavorites();
  });
  
  // Обработчик для кнопки добавления в избранное
  addToFavoritesBtn.addEventListener('click', () => {
    if (!currentProductData) return;
    
    // Проверяем, есть ли уже такой товар в избранном
    const isAlreadyFavorite = favoriteProducts.some(p => p.id === currentProductData.id);
    
    if (isAlreadyFavorite) {
      // Удаляем из избранного
      favoriteProducts = favoriteProducts.filter(p => p.id !== currentProductData.id);
      addToFavoritesBtn.classList.remove('active');
      alert('Товар удален из избранного');
    } else {
      // Добавляем в избранное
      const simplifiedProduct = {
        id: currentProductData.id,
        name: currentProductData.name,
        brand: currentProductData.brand,
        salePriceU: currentProductData.salePriceU,
        imageUrl: productImage.src,
        addedToFavorites: new Date().toISOString()
      };
      
      favoriteProducts.push(simplifiedProduct);
      addToFavoritesBtn.classList.add('active');
      alert('Товар добавлен в избранное');
    }
    
    // Сохраняем обновленный список избранного
    saveFavorites();
    
    // Если мы на вкладке избранного, обновляем отображение
    if (document.getElementById('favorites-tab').classList.contains('active')) {
      displayFavorites();
    }
  });

  // Функция инициализации обработчиков для сворачиваемых блоков
  function initCollapsibleSections() {
    const collapsibleSections = document.querySelectorAll('.section.collapsible');
    
    collapsibleSections.forEach(section => {
      const header = section.querySelector('.section-header');
      const toggleButton = section.querySelector('.toggle-button');
      
      if (header && toggleButton) {
        // Добавляем обработчик на весь заголовок блока
        header.addEventListener('click', (e) => {
          // Если клик был по кнопке, обрабатываем отдельно
          if (e.target === toggleButton) {
            return;
          }
          toggleSection(section, toggleButton);
        });
        
        // Добавляем обработчик на кнопку
        toggleButton.addEventListener('click', () => {
          toggleSection(section, toggleButton);
        });
      }
    });
  }
  
  // Функция сворачивания/разворачивания блока
  function toggleSection(section, button) {
    const isCollapsed = section.classList.toggle('collapsed');
    
    if (isCollapsed) {
      button.textContent = 'Развернуть';
      // Сохраняем состояние в хранилище
      chrome.storage.local.set({ [section.querySelector('h3').textContent + '_collapsed']: true });
    } else {
      button.textContent = 'Свернуть';
      // Сохраняем состояние в хранилище
      chrome.storage.local.set({ [section.querySelector('h3').textContent + '_collapsed']: false });
    }
  }
  
  // Восстановление состояния сворачиваемых блоков при загрузке
  function restoreCollapsibleState() {
    const collapsibleSections = document.querySelectorAll('.section.collapsible');
    
    collapsibleSections.forEach(section => {
      const sectionName = section.querySelector('h3').textContent;
      const toggleButton = section.querySelector('.toggle-button');
      
      chrome.storage.local.get(sectionName + '_collapsed', (result) => {
        const isCollapsed = result[sectionName + '_collapsed'];
        
        if (isCollapsed) {
          section.classList.add('collapsed');
          toggleButton.textContent = 'Развернуть';
        }
      });
    });
  }

  // Сохранение в историю
  saveBtn.addEventListener('click', () => {
    if (!currentProductData) return;
    
    chrome.storage.local.get({ savedProducts: [] }, (result) => {
      const savedProducts = result.savedProducts;
      
      // Проверяем, существует ли уже такой артикул
      const existingIndex = savedProducts.findIndex(p => p.id === currentProductData.id);
      
      // Текущая дата для истории
      const currentDate = new Date().toISOString();
      const currentPrice = currentProductData.salePriceU / 100;
      
      if (existingIndex !== -1) {
        // Обновляем существующий товар
        // Добавляем информацию о цене в историю
        if (!savedProducts[existingIndex].priceHistory) {
          savedProducts[existingIndex].priceHistory = [];
        }
        
        savedProducts[existingIndex].priceHistory.push({
          date: currentDate,
          price: currentPrice
        });
        
        savedProducts[existingIndex] = {
          ...currentProductData,
          priceHistory: savedProducts[existingIndex].priceHistory,
          lastUpdated: currentDate
        };
      } else {
        // Добавляем новый товар
        savedProducts.push({
          ...currentProductData,
          priceHistory: [{
            date: currentDate,
            price: currentPrice
          }],
          firstSaved: currentDate,
          lastUpdated: currentDate
        });
      }
      
      chrome.storage.local.set({ savedProducts }, () => {
        alert('Товар сохранён в историю');
      });
    });
  });

  // Экспорт данных
  exportBtn.addEventListener('click', () => {
    if (!currentProductData) return;
    
    const dataStr = JSON.stringify(currentProductData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `wb_product_${currentProductData.id}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  });

  // Функция поиска товара
  function searchProduct(articleNumber) {
    // Переключаемся на вкладку поиска
    menuItems.forEach(item => {
      if (item.getAttribute('data-tab') === 'search-tab') {
        item.click();
      }
    });
    
    // Очищаем предыдущие результаты
    clearProductData();
    
    // Запускаем поиск
    fetchProductData(articleNumber);
  }

  // Функция для загрузки данных о товаре
  function fetchProductData(articleId) {
    showLoading();
    
    const apiUrl = `https://card.wb.ru/cards/detail?appType=0&curr=rub&dest=-1257786&spp=30&nm=${articleId}`;
    
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!data.data || !data.data.products || data.data.products.length === 0) {
          throw new Error('Товар не найден');
        }
        
        const product = data.data.products[0];
        currentProductData = product;
        
        // Проверяем, есть ли этот товар в избранном
        const isInFavorites = favoriteProducts.some(p => p.id === product.id);
        if (isInFavorites) {
          addToFavoritesBtn.classList.add('active');
        } else {
          addToFavoritesBtn.classList.remove('active');
        }
        
        // Проверяем, есть ли история цен для этого товара
        chrome.storage.local.get({ savedProducts: [] }, (result) => {
          const savedProduct = result.savedProducts.find(p => p.id === product.id);
          if (savedProduct && savedProduct.priceHistory) {
            priceHistory = savedProduct.priceHistory;
          } else {
            priceHistory = [];
          }
          
          displayProductData(product);
          hideLoading();
          showProductInfo();
        });
      })
      .catch(error => {
        console.error('Ошибка при получении данных:', error);
        hideLoading();
        showError();
      });
  }

  // Функция отображения данных о товаре
  function displayProductData(product) {
    // Базовая информация
    productName.textContent = product.name;
    productBrand.textContent = product.brand;
    productSeller.textContent = `Продавец: ${product.supplier} (рейтинг: ${product.supplierRating})`;
    
    // Изображение товара
    const vol = Math.floor(product.id / 100000);
    const part = Math.floor(product.id / 1000);
    let basket = "01";
    
    // Определяем номер корзины
    if (vol <= 143) basket = "01";
    else if (vol <= 287) basket = "02";
    else if (vol <= 431) basket = "03";
    else if (vol <= 719) basket = "04";
    else if (vol <= 1007) basket = "05";
    else if (vol <= 1061) basket = "06";
    else if (vol <= 1115) basket = "07";
    else if (vol <= 1169) basket = "08";
    else if (vol <= 1313) basket = "09";
    else if (vol <= 1601) basket = "10";
    else if (vol <= 1655) basket = "11";
    else if (vol <= 1919) basket = "12";
    else if (vol <= 2045) basket = "13";
    else if (vol <= 2189) basket = "14";
    else if (vol <= 2405) basket = "15";
    else if (vol <= 2621) basket = "16";
    else if (vol <= 2837) basket = "17";
    else if (vol <= 3053) basket = "18";
    else if (vol <= 3269) basket = "19";
    else if (vol <= 3485) basket = "20";
    else if (vol <= 3701) basket = "21";
    else basket = "22";
    
    productImage.src = `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${product.id}/images/big/1.webp`;
    
    // Цена и скидка
    const originalPrice = (product.priceU / 100).toFixed(0);
    const salePrice = (product.salePriceU / 100).toFixed(0);
    
    productPrice.innerHTML = `${salePrice} ₽ <span style="text-decoration: line-through; color: #777; font-size: 14px;">${originalPrice} ₽</span>`;
    productDiscount.textContent = `${product.sale}%`;
    
    // Рейтинг и отзывы
    productRating.textContent = `${product.reviewRating} ★`;
    productFeedbacks.textContent = product.feedbacks;
    
    // Информация о размерах, складах и остатках
    warehouseDistribution.innerHTML = '';
    
    if (!product.sizes || product.sizes.length === 0) {
      warehouseDistribution.innerHTML = '<div class="no-data">Нет данных о размерах и остатках</div>';
      return;
    }
    
    // Получаем общее количество по всем размерам
    let totalQuantityAll = 0;
    let totalFBW = 0;
    let totalFBS = 0;
    
    // Обработка данных для аналитики
    const warehouseData = {};
    const sizeData = {};
    
    // Общая информация о количестве товаров по всем размерам
    product.sizes.forEach(size => {
      const sizeName = size.name || size.origName || 'Без размера';
      
      if (!sizeData[sizeName]) {
        sizeData[sizeName] = 0;
      }
      
      if (size.stocks && size.stocks.length > 0) {
        size.stocks.forEach(stock => {
          const qty = stock.qty;
          totalQuantityAll += qty;
          
          if (stock.dtype === 4) {
            totalFBW += qty;
          } else {
            totalFBS += qty;
          }
          
          sizeData[sizeName] += qty;
          
          const warehouseName = WAREHOUSES[stock.wh] || `Склад ${stock.wh}`;
          if (!warehouseData[warehouseName]) {
            warehouseData[warehouseName] = {
              id: stock.wh,
              total: 0,
              sizes: {},
              deliveryTime: stock.time2
            };
          }
          
          warehouseData[warehouseName].total += qty;
          
          if (!warehouseData[warehouseName].sizes[sizeName]) {
            warehouseData[warehouseName].sizes[sizeName] = 0;
          }
          
          warehouseData[warehouseName].sizes[sizeName] += qty;
        });
      }
    });
    
    // Отображаем общее количество по всем размерам
    const totalInfoElement = document.createElement('div');
    totalInfoElement.className = 'total-info';
    totalInfoElement.innerHTML = `
      <div class="total-quantity">Всего товаров: <strong>${totalQuantityAll} шт.</strong></div>
      <div class="distribution-info">
        <span class="fbw-info">FBW: <strong>${totalFBW} шт.</strong></span>
        <span class="fbs-info">FBS: <strong>${totalFBS} шт.</strong></span>
      </div>
    `;
    warehouseDistribution.appendChild(totalInfoElement);
    
    // Создаем график распределения по размерам
    if (Object.keys(sizeData).length > 0) {
      const sizesChart = document.createElement('div');
      sizesChart.className = 'chart-container';
      sizesChart.innerHTML = '<h4>Распределение по размерам</h4>';
      
      const sizesChartContent = document.createElement('div');
      sizesChartContent.className = 'sizes-chart';
      
      for (const sizeName in sizeData) {
        const percentage = Math.round((sizeData[sizeName] / totalQuantityAll) * 100);
        
        const sizeBar = document.createElement('div');
        sizeBar.className = 'chart-bar';
        sizeBar.innerHTML = `
          <div class="chart-label">${sizeName}</div>
          <div class="chart-bar-container">
            <div class="chart-bar-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="chart-value">${sizeData[sizeName]} шт. (${percentage}%)</div>
        `;
        
        sizesChartContent.appendChild(sizeBar);
      }
      
      sizesChart.appendChild(sizesChartContent);
      warehouseDistribution.appendChild(sizesChart);
    }
    
    // Создаем график распределения по складам
    if (Object.keys(warehouseData).length > 0) {
      const warehousesChart = document.createElement('div');
      warehousesChart.className = 'chart-container';
      warehousesChart.innerHTML = '<h4>Распределение по складам</h4>';
      
      const warehousesChartContent = document.createElement('div');
      warehousesChartContent.className = 'warehouses-chart';
      
      // Сортируем склады по количеству товаров (от большего к меньшему)
      const sortedWarehouses = Object.entries(warehouseData)
        .sort(([, a], [, b]) => b.total - a.total);
      
      // Берем топ-10 складов для наглядности
      const topWarehouses = sortedWarehouses.slice(0, 10);
      
      for (const [warehouseName, data] of topWarehouses) {
        const percentage = Math.round((data.total / totalQuantityAll) * 100);
        
        const warehouseBar = document.createElement('div');
        warehouseBar.className = 'chart-bar';
        
        // Создаем сокращенное имя склада для графика
        let shortName = warehouseName.replace('СЦ ', '').split(' ')[0];
        
        warehouseBar.innerHTML = `
          <div class="chart-label" title="${warehouseName}">${shortName}</div>
          <div class="chart-bar-container">
            <div class="chart-bar-fill ${data.deliveryTime < 40 ? 'fast-delivery' : ''}" style="width: ${percentage}%"></div>
          </div>
          <div class="chart-value">${data.total} шт. (${percentage}%)</div>
        `;
        
        warehousesChartContent.appendChild(warehouseBar);
      }
      
      // Если есть склады после топ-10, группируем их как "Другие"
      if (sortedWarehouses.length > 10) {
        const otherWarehouses = sortedWarehouses.slice(10);
        const otherTotal = otherWarehouses.reduce((sum, [, data]) => sum + data.total, 0);
        const otherPercentage = Math.round((otherTotal / totalQuantityAll) * 100);
        
        const otherBar = document.createElement('div');
        otherBar.className = 'chart-bar';
        otherBar.innerHTML = `
          <div class="chart-label">Другие</div>
          <div class="chart-bar-container">
            <div class="chart-bar-fill other-warehouses" style="width: ${otherPercentage}%"></div>
          </div>
          <div class="chart-value">${otherTotal} шт. (${otherPercentage}%)</div>
        `;
        
        warehousesChartContent.appendChild(otherBar);
      }
      
      warehousesChart.appendChild(warehousesChartContent);
      warehouseDistribution.appendChild(warehousesChart);
    }
    
    // Добавляем раздел с расположением по складам (как на скриншоте)
    const warehouseHeader = document.createElement('h4');
    warehouseHeader.className = 'section-title';
    warehouseHeader.textContent = 'Раскладка по складам';
    warehouseDistribution.appendChild(warehouseHeader);
    
    // Сортируем склады по времени доставки
    const sortedWarehouses = Object.entries(warehouseData)
      .sort(([, a], [, b]) => a.deliveryTime - b.deliveryTime);
    
    const warehouseList = document.createElement('div');
    warehouseList.className = 'warehouse-list';
    
    for (const [warehouseName, data] of sortedWarehouses) {
      const warehouseSection = document.createElement('div');
      warehouseSection.className = 'warehouse-section';
      
      const warehouseHeader = document.createElement('div');
      warehouseHeader.className = 'warehouse-header';
      warehouseHeader.innerHTML = `
        <div class="warehouse-toggle" data-expanded="false">›</div>
        <div class="warehouse-info">
          <span class="warehouse-name">${warehouseName}</span>
          <span class="delivery-time">${data.deliveryTime} ч.</span>
        </div>
        <div class="warehouse-quantity">${data.total} шт.</div>
      `;
      
      // Добавляем обработчик клика для сворачивания/разворачивания
      warehouseHeader.querySelector('.warehouse-toggle').addEventListener('click', function() {
        const sizeList = warehouseSection.querySelector('.size-list');
        const isExpanded = this.getAttribute('data-expanded') === 'true';
        
        if (isExpanded) {
          sizeList.style.display = 'none';
          this.textContent = '›';
          this.setAttribute('data-expanded', 'false');
        } else {
          sizeList.style.display = 'block';
          this.textContent = '⌄';
          this.setAttribute('data-expanded', 'true');
        }
      });
      
      warehouseSection.appendChild(warehouseHeader);
      
      // Добавляем список размеров для этого склада
      const sizeList = document.createElement('div');
      sizeList.className = 'size-list';
      sizeList.style.display = 'none';
      
      const sizesSorted = Object.entries(data.sizes)
        .sort(([aName], [bName]) => {
          // Пытаемся сортировать размеры логически
          const getNumeric = (str) => {
            const match = str.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          
          return getNumeric(aName) - getNumeric(bName);
        });
      
      for (const [sizeName, qty] of sizesSorted) {
        const sizeItem = document.createElement('div');
        sizeItem.className = 'size-item';
        
        let displayName = sizeName;
        
        // Проверяем, нужно ли добавить информацию о длине (для одежды)
        if (sizeName.match(/^\d+/)) {
          const hasLengthInfo = product.sizes.some(s => 
            (s.name === sizeName || s.origName === sizeName) && s.origName && s.origName.includes('Длина')
          );
          
          if (hasLengthInfo) {
            const size = product.sizes.find(s => s.name === sizeName || s.origName === sizeName);
            displayName = `${sizeName} (Длина ${size.origName.match(/Длина (\d+)/)?.[1] || ''} см)`;
          }
        }
        
        sizeItem.innerHTML = `
          <div class="size-name">${displayName}</div>
          <div class="size-quantity">${qty} шт.</div>
        `;
        
        sizeList.appendChild(sizeItem);
      }
      
      warehouseSection.appendChild(sizeList);
      warehouseList.appendChild(warehouseSection);
    }
    
    warehouseDistribution.appendChild(warehouseList);
    
    // История цен, если доступна
    if (priceHistory.length > 1) {
      const priceHistorySection = document.createElement('div');
      priceHistorySection.className = 'price-history-section';
      priceHistorySection.innerHTML = '<h4>История цен</h4>';
      
      // Простая таблица с историей цен
      const historyTable = document.createElement('table');
      historyTable.className = 'price-history-table';
      historyTable.innerHTML = `
        <thead>
          <tr>
            <th>Дата</th>
            <th>Цена</th>
            <th>Изменение</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      `;
      
      const tbody = historyTable.querySelector('tbody');
      
      // Сортируем историю по дате (от новых к старым)
      const sortedHistory = [...priceHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      sortedHistory.forEach((record, index) => {
        const row = document.createElement('tr');
        
        // Форматируем дату
        const date = new Date(record.date);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
        
        let changeText = '';
        let changeClass = '';
        
        if (index < sortedHistory.length - 1) {
          const prevPrice = sortedHistory[index + 1].price;
          const change = record.price - prevPrice;
          const changePercent = Math.round((change / prevPrice) * 100);
          
          if (change > 0) {
            changeText = `+${change.toFixed(0)} ₽ (${changePercent}%)`;
            changeClass = 'price-up';
          } else if (change < 0) {
            changeText = `${change.toFixed(0)} ₽ (${changePercent}%)`;
            changeClass = 'price-down';
          } else {
            changeText = 'Без изменений';
            changeClass = 'price-same';
          }
        } else {
          changeText = 'Начальная цена';
        }
        
        row.innerHTML = `
          <td>${formattedDate}</td>
          <td>${record.price.toFixed(0)} ₽</td>
          <td class="${changeClass}">${changeText}</td>
        `;
        
        tbody.appendChild(row);
      });
      
      priceHistorySection.appendChild(historyTable);
      warehouseDistribution.appendChild(priceHistorySection);
    }
    
    // Информация о логистике
    logisticsInfo.innerHTML = '';
    
    if (product.sizes && product.sizes.length > 0) {
      const size = product.sizes[0]; // Берем первый размер для анализа логистики
      
      if (size.stocks && size.stocks.length > 0) {
        // Находим минимальное время сборки и доставки
        const minTimeStock = size.stocks.reduce((prev, current) => {
          const prevTotal = prev.time1 + prev.time2;
          const currentTotal = current.time1 + current.time2;
          return prevTotal <= currentTotal ? prev : current;
        });
        
        const logisticsItem1 = document.createElement('div');
        logisticsItem1.className = 'logistics-item';
        logisticsItem1.innerHTML = `
          <span>Метод доставки:</span>
          <span>${minTimeStock.dtype === 4 ? 'FBW (со склада WB)' : 'FBS (от продавца)'}</span>
        `;
        
        const logisticsItem2 = document.createElement('div');
        logisticsItem2.className = 'logistics-item';
        logisticsItem2.innerHTML = `
          <span>Время сборки:</span>
          <span>${minTimeStock.time1} ч.</span>
        `;
        
        const logisticsItem3 = document.createElement('div');
        logisticsItem3.className = 'logistics-item';
        logisticsItem3.innerHTML = `
          <span>Время доставки:</span>
          <span>${minTimeStock.time2} ч.</span>
        `;
        
        const logisticsItem4 = document.createElement('div');
        logisticsItem4.className = 'logistics-item';
        logisticsItem4.innerHTML = `
          <span>Общее время:</span>
          <span>${minTimeStock.time1 + minTimeStock.time2} ч.</span>
        `;
        
        logisticsInfo.appendChild(logisticsItem1);
        logisticsInfo.appendChild(logisticsItem2);
        logisticsInfo.appendChild(logisticsItem3);
        logisticsInfo.appendChild(logisticsItem4);
      }
    }
  }

  // Вспомогательные функции для управления UI
  function showLoading() {
    loadingIndicator.classList.remove('hidden');
    productInfo.classList.add('hidden');
    errorMessage.classList.add('hidden');
  }

  function hideLoading() {
    loadingIndicator.classList.add('hidden');
  }

  function showProductInfo() {
    productInfo.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    // Восстанавливаем состояние сворачиваемых блоков
    restoreCollapsibleState();
  }

  function showError() {
    errorMessage.classList.remove('hidden');
    productInfo.classList.add('hidden');
  }

  // Функция для отображения данных о складах
  function displayWarehouseData() {
    // Очищаем текущий список складов
    warehouseList.innerHTML = '';
    
    // Получаем значение для поиска
    const searchText = warehouseSearch.value.toLowerCase();
    
    // Получаем выбранный метод сортировки
    const sortBy = warehouseSort.value;
    
    // Получаем значения фильтров
    const showFBW = filterFBW.checked;
    const showFBS = filterFBS.checked;
    
    // Преобразуем объект WAREHOUSE_DETAILS в массив для удобства обработки
    let warehouses = Object.entries(WAREHOUSE_DETAILS).map(([id, details]) => {
      return {
        id: id,
        ...details
      };
    });
    
    // Применяем фильтр по типу склада
    warehouses = warehouses.filter(warehouse => {
      return (showFBW && warehouse.is_fbw) || (showFBS && warehouse.is_fbs);
    });
    
    // Применяем фильтр по поисковому запросу
    if (searchText) {
      warehouses = warehouses.filter(warehouse => {
        return warehouse.name.toLowerCase().includes(searchText) || 
               warehouse.city.toLowerCase().includes(searchText) ||
               warehouse.address.toLowerCase().includes(searchText);
      });
    }
    
    // Применяем сортировку
    switch (sortBy) {
      case 'name':
        warehouses.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'delivery':
        warehouses.sort((a, b) => {
          const deliveryA = parseInt(a.delivery_time) || 999;
          const deliveryB = parseInt(b.delivery_time) || 999;
          return deliveryA - deliveryB;
        });
        break;
      case 'rating':
        warehouses.sort((a, b) => b.rating - a.rating);
        break;
    }
    
    // Добавляем сортировку
    const sortByElement = document.createElement('div');
    sortByElement.className = 'sort-by';
    sortByElement.innerHTML = `
      Сортировать по: 
      <select id="sortByDropdown">
        <option value="rating">Рейтингу</option>
        <option value="delivery">Доставке</option>
        <option value="name">Названию</option>
      </select>
    `;
    warehouseList.appendChild(sortByElement);
    
    // Событие на изменение сортировки
    const sortByDropdown = document.getElementById('sortByDropdown');
    sortByDropdown.value = sortBy;
    sortByDropdown.addEventListener('change', () => {
      warehouseSort.value = sortByDropdown.value;
      displayWarehouseData();
    });
    
    // Создаем карточки для каждого склада
    warehouses.forEach(warehouse => {
      // Определяем класс качества (A, B, C) на основе рейтинга
      let qualityClass = 'C';
      if (warehouse.rating >= 4.8) {
        qualityClass = 'A';
      } else if (warehouse.rating >= 4.5) {
        qualityClass = 'B';
      }
      
      // Определяем класс для времени доставки
      let deliveryClass = '';
      let deliveryTime = parseInt(warehouse.delivery_time);
      
      if (deliveryTime) {
        if (deliveryTime <= 48) {
          deliveryClass = 'fast-delivery';
        } else if (deliveryTime <= 72) {
          deliveryClass = 'medium-delivery';
        } else {
          deliveryClass = 'slow-delivery';
        }
      }
      
      // Создаем HTML-элемент для карточки склада
      const card = document.createElement('div');
      card.className = 'warehouse-card';
      card.setAttribute('data-quality', qualityClass);
      
      // Заполняем содержимое карточки
      card.innerHTML = `
        <div class="warehouse-info">
          <h4>${warehouse.name}</h4>
          <div class="warehouse-id">ID: ${warehouse.id}</div>
          
          <div class="material-quality">
            Рейтинг: ${warehouse.rating}
          </div>
          
          <div class="warehouse-info-item">
            <span>Доставка:</span>
            <span class="${deliveryClass}">${warehouse.delivery_time ? warehouse.delivery_time + ' ч' : 'нет данных'}</span>
          </div>
          
          <div class="warehouse-type">
            ${warehouse.is_fbw ? '<span class="warehouse-type-tag tag-fbw">FBW</span>' : ''}
            ${warehouse.is_fbs ? '<span class="warehouse-type-tag tag-fbs">FBS</span>' : ''}
          </div>
          
          <a href="#" class="view-on-btn">Детали склада</a>
        </div>
      `;
      
      // Добавляем обработчик для отображения дополнительной информации при клике
      card.querySelector('.view-on-btn').addEventListener('click', (e) => {
        e.preventDefault();
        alert(`
          Полная информация о складе:
          Название: ${warehouse.name}
          ID: ${warehouse.id}
          Адрес: ${warehouse.address}
          Координаты: ${warehouse.coords[0]}, ${warehouse.coords[1]}
          Время доставки: ${warehouse.delivery_time ? warehouse.delivery_time + ' ч' : 'нет данных'}
          Город: ${warehouse.city || 'не указан'}
          Типы операций: ${warehouse.is_fbw ? 'FBW' : ''} ${warehouse.is_fbs ? 'FBS' : ''}
          Рейтинг: ${warehouse.rating}
        `);
      });
      
      // Добавляем карточку в список
      warehouseList.appendChild(card);
    });
    
    // Если склады не найдены
    if (warehouses.length === 0) {
      warehouseList.innerHTML = '<div class="no-results">Склады не найдены</div>';
    }
  }

  // Функция для очистки данных о товаре
  function clearProductData() {
    // Скрываем блоки с информацией и ошибками
    productInfo.classList.add('hidden');
    errorMessage.classList.add('hidden');
    
    // Очищаем содержимое блоков
    productImage.src = '';
    productName.textContent = '';
    productBrand.textContent = '';
    productSeller.textContent = '';
    productPrice.textContent = '';
    productDiscount.textContent = '';
    productRating.textContent = '';
    productFeedbacks.textContent = '';
    warehouseDistribution.innerHTML = '';
    logisticsInfo.innerHTML = '';
  }
  
  // Функция загрузки избранных товаров из хранилища
  function loadFavorites() {
    chrome.storage.local.get({ favoriteProducts: [] }, (result) => {
      favoriteProducts = result.favoriteProducts;
    });
  }
  
  // Функция сохранения избранных товаров в хранилище
  function saveFavorites() {
    chrome.storage.local.set({ favoriteProducts });
  }
  
  // Функция отображения избранных товаров
  function displayFavorites() {
    // Очищаем текущий список избранного
    favoritesList.innerHTML = '';
    
    // Получаем значение для поиска
    const searchText = favoritesSearch.value.toLowerCase();
    
    // Фильтруем избранные товары по поисковому запросу
    let filteredFavorites = favoriteProducts;
    if (searchText) {
      filteredFavorites = favoriteProducts.filter(product => 
        product.name.toLowerCase().includes(searchText) || 
        product.brand.toLowerCase().includes(searchText)
      );
    }
    
    // Если список избранного пуст
    if (filteredFavorites.length === 0) {
      noFavorites.style.display = 'block';
    } else {
      noFavorites.style.display = 'none';
      
      // Сортируем избранные товары по дате добавления (новые сверху)
      filteredFavorites.sort((a, b) => new Date(b.addedToFavorites) - new Date(a.addedToFavorites));
      
      // Создаем карточки для каждого избранного товара
      filteredFavorites.forEach(product => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';
        favoriteItem.setAttribute('data-id', product.id);
        
        // Преобразуем цену из копеек в рубли
        const price = (product.salePriceU / 100).toFixed(0);
        
        // Формируем дату добавления
        const addedDate = new Date(product.addedToFavorites);
        const formattedDate = `${addedDate.getDate().toString().padStart(2, '0')}.${(addedDate.getMonth() + 1).toString().padStart(2, '0')}.${addedDate.getFullYear()}`;
        
        favoriteItem.innerHTML = `
          <div class="favorite-image">
            <img src="${product.imageUrl}" alt="${product.name}">
          </div>
          <div class="favorite-info">
            <div class="favorite-name">${product.name}</div>
            <div class="favorite-brand">${product.brand}</div>
            <div class="favorite-price">${price} ₽</div>
          </div>
          <div class="favorite-remove" title="Удалить из избранного">&times;</div>
        `;
        
        // Добавляем обработчик для перехода на карточку товара при клике
        favoriteItem.addEventListener('click', (e) => {
          // Проверяем, что клик был не по кнопке удаления
          if (!e.target.classList.contains('favorite-remove')) {
            searchProduct(product.id);
          }
        });
        
        // Добавляем обработчик для удаления из избранного
        const removeBtn = favoriteItem.querySelector('.favorite-remove');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Предотвращаем всплытие события клика
          
          // Удаляем товар из списка избранного
          favoriteProducts = favoriteProducts.filter(p => p.id !== product.id);
          
          // Если текущий просматриваемый товар - это тот, который удаляется из избранного
          if (currentProductData && currentProductData.id === product.id) {
            addToFavoritesBtn.classList.remove('active');
          }
          
          // Сохраняем обновленный список
          saveFavorites();
          
          // Обновляем отображение списка избранного
          displayFavorites();
        });
        
        favoritesList.appendChild(favoriteItem);
      });
    }
  }
}); 