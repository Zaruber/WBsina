document.addEventListener('DOMContentLoaded', () => {
  const articleInput = document.getElementById('articleInput');
  const searchBtn = document.getElementById('searchBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const productInfo = document.getElementById('productInfo');
  const errorMessage = document.getElementById('errorMessage');
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const addToFavoritesBtn = document.getElementById('addToFavoritesBtn');
  const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');

  // Элементы информации о товаре
  const productImage = document.getElementById('productImage');
  const productName = document.getElementById('productName');
  const productBrand = document.getElementById('productBrand');
  const productSeller = document.getElementById('productSeller');
  const productCategory = document.getElementById('productCategory');
  const productColors = document.getElementById('productColors');
  const productPics = document.getElementById('productPics');
  const productSizesChips = document.getElementById('productSizes');
  const productLink = document.getElementById('productLink');
  const productPrice = document.getElementById('productPrice');
  const productDiscount = document.getElementById('productDiscount');
  const productRating = document.getElementById('productRating');
  const productFeedbacks = document.getElementById('productFeedbacks');
  const warehouseDistribution = document.getElementById('warehouseDistribution');
  const logisticsInfo = document.getElementById('logisticsInfo');
  const historyInfo = document.getElementById('historyInfo');
  
  // Элементы для работы с меню
  const menuItems = document.querySelectorAll('.main-menu li');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Вкладка складов удалена
  const warehouseSearch = null;
  const warehouseSort = null;
  const filterFBW = { checked: true };
  const filterFBS = { checked: true };
  const warehouseList = null;
  
  // Элементы для работы с избранным
  const favoritesList = document.getElementById('favoritesList');
  const favoritesSearch = document.getElementById('favoritesSearch');
  const noFavorites = document.getElementById('noFavorites');

  // Динамические данные о складах из acceptanceCoefficientsReport.json
  let ACCEPTANCE_DATA = {};
  loadAcceptanceData();

  function loadAcceptanceData() {
    try {
      const url = chrome.runtime.getURL('acceptanceCoefficientsReport.json');
      fetch(url)
        .then(r => r.json())
        .then(json => {
          const report = (json && json.result && Array.isArray(json.result.report)) ? json.result.report : [];
          const map = {};
          for (const item of report) {
            const id = String(item.warehouseID);
            if (!map[id]) {
              map[id] = {
                id,
                name: item.warehouseName || `Склад ${id}`,
                isSortingCenter: Boolean(item.isSortingCenter),
                allowUnload: Boolean(item.allowUnload),
                types: {}
              };
            }
            // Обновляем имя и флаги, если в других записях более актуально
            if (item.warehouseName) map[id].name = item.warehouseName;
            if (item.isSortingCenter) map[id].isSortingCenter = true;
            if (item.allowUnload) map[id].allowUnload = true;

            const t = String(item.acceptanceType ?? '');
            if (t) {
              map[id].types[t] = {
                coefficient: item.coefficient,
                deliveryCoefficient: item.deliveryCoefficient,
                storageCoefficient: item.storageCoefficient,
                deliveryBaseLiter: item.deliveryBaseLiter,
                deliveryAdditionalLiter: item.deliveryAdditionalLiter,
                storageBaseLiter: item.storageBaseLiter,
                storageAdditionalLiter: item.storageAdditionalLiter
              };
            }
          }
          ACCEPTANCE_DATA = map;
          // Вкладка складов удалена
        })
        .catch(() => {});
    } catch (_) {}
  }

  function getWarehouseNameById(warehouseId) {
    const id = String(warehouseId);
    if (ACCEPTANCE_DATA[id] && ACCEPTANCE_DATA[id].name) return ACCEPTANCE_DATA[id].name;
    if (typeof WAREHOUSES !== 'undefined' && WAREHOUSES[id]) return WAREHOUSES[id];
    return `Склад ${id}`;
  }

  function getMergedWarehouseDetailsById(warehouseId) {
    const id = String(warehouseId);
    const ad = ACCEPTANCE_DATA[id] || {};
    const sd = (typeof WAREHOUSE_DETAILS !== 'undefined' && WAREHOUSE_DETAILS[id]) ? WAREHOUSE_DETAILS[id] : {};
    return {
      id,
      name: ad.name || sd.name || getWarehouseNameById(id),
      address: sd.address || '',
      coords: sd.coords || [],
      city: sd.city || '',
      rating: sd.rating || 0,
      delivery_time: sd.delivery_time || '',
      is_fbw: sd.is_fbw || Boolean(ad.types && (ad.types['4'] || ad.types[4])),
      is_fbs: sd.is_fbs || Boolean(ad.types && (ad.types['6'] || ad.types[6])),
      acceptance: ad
    };
  }

  function inferDeliveryFromAcceptance(warehouseId) {
    const id = String(warehouseId);
    const ad = ACCEPTANCE_DATA[id];
    if (!ad || !ad.types) return undefined;
    const t4 = ad.types['4'] || ad.types[4];
    const t6 = ad.types['6'] || ad.types[6];
    const cand = [t4, t6]
      .map(t => t && parseInt(t.deliveryCoefficient))
      .filter(v => Number.isFinite(v));
    if (cand.length === 0) return undefined;
    return Math.min(...cand);
  }

  // Определение метода доставки для записи stock v4
  function getStockDeliveryType(stock) {
    const merged = getMergedWarehouseDetailsById(stock.wh);
    const hasFBW = Boolean(merged && merged.is_fbw);
    const hasFBS = Boolean(merged && merged.is_fbs);
    // Если известен только один тип — возвращаем его
    if (hasFBW && !hasFBS) return 'FBW';
    if (hasFBS && !hasFBW) return 'FBS';
    // Если оба допустимы или неизвестно — используем эвристику по времени сборки
    const t1 = Number(stock.time1) || 0;
    // FBS чаще имеет высокое время сборки (24+), FBW — низкое (<= 6)
    if (t1 === 0) return hasFBW ? 'FBW' : 'FBS';
    return t1 <= 6 ? 'FBW' : 'FBS';
  }

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
      
      // Вкладка складов удалена
      
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

  // Вкладка складов удалена

  // Вкладка складов удалена

  // Вкладка складов удалена
  
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
        salePriceU: getProductPriceInfo(currentProductData).salePriceU,
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

  // Обработчик для кнопки синхронизации избранного
  syncFavoritesBtn.addEventListener('click', () => {
    syncFavorites();
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
        
        // Добавляем новую запись в историю цен
        savedProducts[existingIndex].priceHistory.push({
          date: currentDate,
          price: getProductPriceInfo(currentProductData).salePriceU / 100,
          savedData: {
            // Добавляем ключевые данные для отслеживания истории
            feedbacks: currentProductData.feedbacks,
            sizes: currentProductData.sizes
          }
        });
        
        // Добавляем информацию об отзывах в историю
        if (!savedProducts[existingIndex].feedbacksHistory) {
          savedProducts[existingIndex].feedbacksHistory = [];
        }
        
        savedProducts[existingIndex].feedbacksHistory.push({
          date: currentDate,
          count: currentProductData.feedbacks
        });
        
        // Обновляем данные товара
        savedProducts[existingIndex] = {
          ...currentProductData,
          priceHistory: savedProducts[existingIndex].priceHistory,
          feedbacksHistory: savedProducts[existingIndex].feedbacksHistory,
          lastUpdated: currentDate
        };
      } else {
        // Добавляем новый товар
        savedProducts.push({
          ...currentProductData,
          priceHistory: [{
            date: currentDate,
            price: getProductPriceInfo(currentProductData).salePriceU / 100,
            savedData: {
              // Добавляем ключевые данные для отслеживания истории
              feedbacks: currentProductData.feedbacks,
              sizes: currentProductData.sizes
            }
          }],
          feedbacksHistory: [{
            date: currentDate,
            count: currentProductData.feedbacks
          }],
          firstSaved: currentDate,
          lastUpdated: currentDate
        });
      }
      
      chrome.storage.local.set({ savedProducts }, () => {
        alert('Товар сохранён в историю');
        // Обновляем отображение истории, если она видна
        if (!document.querySelector('#historyInfo').closest('.section').classList.contains('collapsed')) {
          displayProductData(currentProductData);
        }
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
    
    // Эндпоинт v4 (устойчивее к антиботу WB). Поддерживает несколько артикулов через ';'
    const apiUrl = buildV4DetailUrl([articleId]);
    
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Совместимость со старыми/новыми объектами ответа
        const products = (data && data.data && data.data.products) ? data.data.products : data.products;
        if (!products || products.length === 0) {
          throw new Error('Товар не найден');
        }
        
        const product = products[0];
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

  // Построитель URL для v4 detail
  function buildV4DetailUrl(articleIds) {
    const nmParam = encodeURIComponent(articleIds.join(';'));
    const params = new URLSearchParams({
      appType: '32',
      curr: 'rub',
      dest: '-2162195',
      hide_dtype: '13',
      spp: '30',
      ab_testing: 'false',
      lang: 'ru',
      nm: nmParam
    });
    return `https://card.wb.ru/cards/v4/detail?${params.toString()}`;
  }

  // Универсальная нормализация цен из объекта товара WB (v3/v4)
  function getProductPriceInfo(product) {
    // В старом ответе были поля priceU, salePriceU, sale
    if (typeof product.priceU === 'number' && typeof product.salePriceU === 'number') {
      const priceU = product.priceU;
      const salePriceU = product.salePriceU;
      const discountPercent = product.sale ?? Math.round((1 - salePriceU / Math.max(priceU, 1)) * 100);
      return { priceU, salePriceU, discountPercent };
    }
    
    // В v4 внутри размера есть price { basic, product } и может быть общий уровень
    // Попытаемся найти минимальный price по любому размеру (релевантная цена карточки)
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      let basicMin = Infinity;
      let productMin = Infinity;
      for (const size of product.sizes) {
        if (size && size.price && typeof size.price.basic === 'number' && typeof size.price.product === 'number') {
          basicMin = Math.min(basicMin, size.price.basic);
          productMin = Math.min(productMin, size.price.product);
        }
      }
      if (isFinite(basicMin) && isFinite(productMin)) {
        const priceU = basicMin;        // уже в копейках
        const salePriceU = productMin;  // уже в копейках
        const discountPercent = Math.max(0, Math.round((1 - salePriceU / Math.max(priceU, 1)) * 100));
        return { priceU, salePriceU, discountPercent };
      }
    }
    
    // Фолбэк: если ничего не нашли, считаем без скидки
    const fallback = (product.salePriceU ?? product.priceU ?? 0);
    return { priceU: fallback, salePriceU: fallback, discountPercent: 0 };
  }

  // Функция отображения данных о товаре
  function displayProductData(product) {
    // Базовая информация
    productName.textContent = product.name;
    productBrand.textContent = product.brand;
    productSeller.textContent = `Продавец: ${product.supplier} (рейтинг: ${product.supplierRating})`;
    
    // Универсальная информация о ценах (совместимо с v4)
    const priceInfo = getProductPriceInfo(product);

    // Категория товара
    productCategory.textContent = product.entity || '';

    // Фото
    productPics.textContent = Number.isFinite(product.pics) ? product.pics : '';

    // Цвета
    productColors.innerHTML = '';
    if (Array.isArray(product.colors) && product.colors.length > 0) {
      product.colors.slice(0, 10).forEach(color => {
        const chip = document.createElement('span');
        chip.className = 'chip color-chip';
        const dot = document.createElement('span');
        dot.className = 'chip-dot';
        // Попытка приблизить цвет из имени (простая эвристика)
        const low = (color.name || '').toLowerCase();
        if (low.includes('черн')) dot.style.backgroundColor = '#000';
        else if (low.includes('бел')) dot.style.backgroundColor = '#fff';
        else if (low.includes('крас')) dot.style.backgroundColor = '#e53935';
        else if (low.includes('син')) dot.style.backgroundColor = '#1e88e5';
        else if (low.includes('голуб')) dot.style.backgroundColor = '#64b5f6';
        else if (low.includes('зелен')) dot.style.backgroundColor = '#43a047';
        else if (low.includes('желт')) dot.style.backgroundColor = '#fdd835';
        else if (low.includes('оранж')) dot.style.backgroundColor = '#fb8c00';
        else if (low.includes('фиолет')) dot.style.backgroundColor = '#8e24aa';
        else if (low.includes('роз')) dot.style.backgroundColor = '#ec407a';
        else dot.style.backgroundColor = '#ccc';
        chip.appendChild(dot);
        const label = document.createElement('span');
        label.textContent = color.name;
        chip.appendChild(label);
        productColors.appendChild(chip);
      });
    }

    // Размеры (чипы)
    productSizesChips.innerHTML = '';
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      const uniq = new Set();
      product.sizes.forEach(s => {
        const display = s.name || s.origName || 'Без размера';
        if (display && !uniq.has(display)) {
          uniq.add(display);
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = display;
          productSizesChips.appendChild(chip);
        }
      });
    }

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

    // Ссылка на карточку на WB
    if (productLink) {
      productLink.href = `https://wildberries.ru/catalog/${product.id}/detail.aspx`;
    }
    
    // Цена и скидка (на основе priceInfo)
    const originalPrice = (priceInfo.priceU / 100).toFixed(0);
    const salePrice = (priceInfo.salePriceU / 100).toFixed(0);
    
    productPrice.innerHTML = `${salePrice} ₽ <span style="text-decoration: line-through; color: #777; font-size: 14px;">${originalPrice} ₽</span>`;
    productDiscount.textContent = `${priceInfo.discountPercent}%`;
    
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
          
          const method = getStockDeliveryType(stock);
          if (method === 'FBW') totalFBW += qty;
          else totalFBS += qty;
          
          sizeData[sizeName] += qty;
          
          const warehouseName = getWarehouseNameById(stock.wh);
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
        const inferredType = getStockDeliveryType(minTimeStock);
        logisticsItem1.innerHTML = `
          <span>Метод доставки:</span>
          <span>${inferredType === 'FBW' ? 'FBW (со склада WB)' : 'FBS (от продавца)'}</span>
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
    
    // Отображение истории товара
    historyInfo.innerHTML = '';
    
    // Загружаем историю товара из локального хранилища
    chrome.storage.local.get({ savedProducts: [] }, (result) => {
      const savedProduct = result.savedProducts.find(p => p.id === product.id);
      
      if (!savedProduct || !savedProduct.priceHistory || savedProduct.priceHistory.length <= 1) {
        historyInfo.innerHTML = '<div class="no-data">История не найдена. Сохраните товар в историю, чтобы отслеживать изменения.</div>';
        return;
      }
      
      // Создаем секцию истории цен
      const priceHistorySection = document.createElement('div');
      priceHistorySection.className = 'history-section';
      
      // Заголовок истории цен
      const priceHistoryTitle = document.createElement('h4');
      priceHistoryTitle.className = 'history-title';
      priceHistoryTitle.textContent = 'История цен';
      priceHistorySection.appendChild(priceHistoryTitle);
      
      // Таблица истории цен
      const priceHistoryTable = document.createElement('table');
      priceHistoryTable.className = 'history-table';
      
      // Заголовок таблицы
      priceHistoryTable.innerHTML = `
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
      
      const tbody = priceHistoryTable.querySelector('tbody');
      
      // Сортируем историю по дате (от новых к старым)
      const sortedHistory = [...savedProduct.priceHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      // Добавляем строки с историей цен
      sortedHistory.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        // Форматируем дату
        const date = new Date(entry.date);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        
        // Вычисляем изменение цены
        let priceChange = '';
        let changeClass = '';
        
        if (index < sortedHistory.length - 1) {
          const diff = entry.price - sortedHistory[index + 1].price;
          const percentChange = ((diff / sortedHistory[index + 1].price) * 100).toFixed(1);
          
          if (diff > 0) {
            priceChange = `+${diff.toFixed(0)} ₽ (+${percentChange}%)`;
            changeClass = 'price-up';
          } else if (diff < 0) {
            priceChange = `${diff.toFixed(0)} ₽ (${percentChange}%)`;
            changeClass = 'price-down';
          } else {
            priceChange = 'Без изменений';
            changeClass = 'price-same';
          }
        } else {
          priceChange = 'Первое сохранение';
          changeClass = 'price-same';
        }
        
        row.innerHTML = `
          <td>${formattedDate}</td>
          <td>${entry.price.toFixed(0)} ₽</td>
          <td class="${changeClass}">${priceChange}</td>
        `;
        
        tbody.appendChild(row);
      });
      
      priceHistorySection.appendChild(priceHistoryTable);
      historyInfo.appendChild(priceHistorySection);
      
      // Добавляем историю отзывов, если есть несколько сохранений
      if (sortedHistory.length > 1 && savedProduct.feedbacksHistory) {
        const feedbacksHistorySection = document.createElement('div');
        feedbacksHistorySection.className = 'history-section';
        
        const feedbacksHistoryTitle = document.createElement('h4');
        feedbacksHistoryTitle.className = 'history-title';
        feedbacksHistoryTitle.textContent = 'История отзывов';
        feedbacksHistorySection.appendChild(feedbacksHistoryTitle);
        
        const feedbacksHistoryTable = document.createElement('table');
        feedbacksHistoryTable.className = 'history-table';
        
        feedbacksHistoryTable.innerHTML = `
          <thead>
            <tr>
              <th>Дата</th>
              <th>Отзывы</th>
              <th>Изменение</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        `;
        
        const feedbacksTbody = feedbacksHistoryTable.querySelector('tbody');
        
        // Если есть данные истории отзывов
        if (savedProduct.feedbacksHistory && savedProduct.feedbacksHistory.length > 0) {
          const sortedFeedbacksHistory = [...savedProduct.feedbacksHistory].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
          );
          
          sortedFeedbacksHistory.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            // Форматируем дату
            const date = new Date(entry.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            // Вычисляем изменение кол-ва отзывов
            let feedbacksChange = '';
            let changeClass = '';
            
            if (index < sortedFeedbacksHistory.length - 1) {
              const diff = entry.count - sortedFeedbacksHistory[index + 1].count;
              
              if (diff > 0) {
                feedbacksChange = `+${diff}`;
                changeClass = 'price-up'; // Используем тот же класс для цветового оформления
              } else if (diff < 0) {
                feedbacksChange = `${diff}`;
                changeClass = 'price-down';
              } else {
                feedbacksChange = 'Без изменений';
                changeClass = 'price-same';
              }
            } else {
              feedbacksChange = 'Первое сохранение';
              changeClass = 'price-same';
            }
            
            row.innerHTML = `
              <td>${formattedDate}</td>
              <td>${entry.count}</td>
              <td class="${changeClass}">${feedbacksChange}</td>
            `;
            
            feedbacksTbody.appendChild(row);
          });
        } else {
          // Создаем историю на основе общей истории сохранений
          sortedHistory.forEach((entry, index) => {
            if (!entry.savedData || !entry.savedData.feedbacks) return;
            
            const row = document.createElement('tr');
            
            // Форматируем дату
            const date = new Date(entry.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            // Вычисляем изменение кол-ва отзывов
            let feedbacksChange = '';
            let changeClass = '';
            
            if (index < sortedHistory.length - 1 && sortedHistory[index + 1].savedData && sortedHistory[index + 1].savedData.feedbacks) {
              const diff = entry.savedData.feedbacks - sortedHistory[index + 1].savedData.feedbacks;
              
              if (diff > 0) {
                feedbacksChange = `+${diff}`;
                changeClass = 'price-up';
              } else if (diff < 0) {
                feedbacksChange = `${diff}`;
                changeClass = 'price-down';
              } else {
                feedbacksChange = 'Без изменений';
                changeClass = 'price-same';
              }
            } else {
              feedbacksChange = 'Первое сохранение';
              changeClass = 'price-same';
            }
            
            row.innerHTML = `
              <td>${formattedDate}</td>
              <td>${entry.savedData.feedbacks}</td>
              <td class="${changeClass}">${feedbacksChange}</td>
            `;
            
            feedbacksTbody.appendChild(row);
          });
        }
        
        feedbacksHistorySection.appendChild(feedbacksHistoryTable);
        historyInfo.appendChild(feedbacksHistorySection);
      }
      
      // Добавляем историю остатков по размерам
      if (sortedHistory.length > 1) {
        const stockHistorySection = document.createElement('div');
        stockHistorySection.className = 'history-section';
        
        const stockHistoryTitle = document.createElement('h4');
        stockHistoryTitle.className = 'history-title';
        stockHistoryTitle.textContent = 'История остатков по размерам';
        stockHistorySection.appendChild(stockHistoryTitle);
        
        // Создаем таблицу с историей остатков по размерам
        const stockHistoryTable = document.createElement('table');
        stockHistoryTable.className = 'history-table stock-history-table';
        
        // Собираем все размеры, которые встречались в сохранениях
        const allSizes = new Set();
        const savedDataWithSizes = [];
        
        sortedHistory.forEach((entry) => {
          // Проверяем, что есть сохраненные данные о размерах
          if (entry.savedData && entry.savedData.sizes) {
            entry.savedData.sizes.forEach(size => {
              const sizeName = size.name || size.origName || 'Без размера';
              allSizes.add(sizeName);
            });
            
            // Добавляем в массив данные с датой для дальнейшей обработки
            savedDataWithSizes.push({
              date: entry.date,
              sizes: entry.savedData.sizes
            });
          }
        });
        
        // Если есть данные о размерах
        if (allSizes.size > 0 && savedDataWithSizes.length > 0) {
          // Формируем заголовок таблицы
          const headerRow = document.createElement('tr');
          headerRow.innerHTML = '<th>Дата</th>';
          
          // Добавляем колонки для каждого размера
          allSizes.forEach(sizeName => {
            headerRow.innerHTML += `<th>${sizeName}</th>`;
          });
          
          // Создаем и добавляем thead с заголовком
          const thead = document.createElement('thead');
          thead.appendChild(headerRow);
          stockHistoryTable.appendChild(thead);
          
          // Создаем tbody
          const stockTbody = document.createElement('tbody');
          
          // Добавляем строки с историей остатков
          savedDataWithSizes.forEach((entry) => {
            const row = document.createElement('tr');
            
            // Форматируем дату
            const date = new Date(entry.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            row.innerHTML = `<td>${formattedDate}</td>`;
            
            // Для каждого размера добавляем его количество
            allSizes.forEach(sizeName => {
              // Находим размер в текущем сохранении
              let totalQty = 0;
              const size = entry.sizes.find(s => (s.name || s.origName) === sizeName);
              
              if (size && size.stocks) {
                // Считаем общее количество по всем складам для этого размера
                totalQty = size.stocks.reduce((sum, stock) => sum + stock.qty, 0);
              }
              
              row.innerHTML += `<td>${totalQty}</td>`;
            });
            
            stockTbody.appendChild(row);
          });
          
          stockHistoryTable.appendChild(stockTbody);
          stockHistorySection.appendChild(stockHistoryTable);
          historyInfo.appendChild(stockHistorySection);
        }
      }
      
      // Добавляем историю остатков по складам
      if (sortedHistory.length > 1) {
        const warehouseHistorySection = document.createElement('div');
        warehouseHistorySection.className = 'history-section';
        
        const warehouseHistoryTitle = document.createElement('h4');
        warehouseHistoryTitle.className = 'history-title';
        warehouseHistoryTitle.textContent = 'История остатков по складам';
        warehouseHistorySection.appendChild(warehouseHistoryTitle);
        
        // Создаем таблицу с историей остатков по складам
        const warehouseHistoryTable = document.createElement('table');
        warehouseHistoryTable.className = 'history-table warehouse-history-table';
        
        // Собираем все склады, которые встречались в сохранениях
        const allWarehouses = new Set();
        const warehouseDataHistory = [];
        
        sortedHistory.forEach((entry) => {
          // Проверяем, что есть сохраненные данные о размерах и складах
          if (entry.savedData && entry.savedData.sizes) {
            // Для каждого сохранения готовим данные по складам
            const warehouseData = {};
            
            entry.savedData.sizes.forEach(size => {
              if (size.stocks) {
                size.stocks.forEach(stock => {
                  const warehouseId = stock.wh;
         const warehouseName = getWarehouseNameById(warehouseId);
                  allWarehouses.add(warehouseName);
                  
                  if (!warehouseData[warehouseName]) {
                    warehouseData[warehouseName] = 0;
                  }
                  
                  warehouseData[warehouseName] += stock.qty;
                });
              }
            });
            
            // Добавляем в массив данные с датой для дальнейшей обработки
            warehouseDataHistory.push({
              date: entry.date,
              warehouses: warehouseData
            });
          }
        });
        
        // Если есть данные о складах
        if (allWarehouses.size > 0 && warehouseDataHistory.length > 0) {
          // Формируем заголовок таблицы
          const headerRow = document.createElement('tr');
          headerRow.innerHTML = '<th>Дата</th>';
          
          // Добавляем колонки для каждого склада (берем только топ-10 по популярности)
          const warehousesArray = Array.from(allWarehouses);
          const topWarehouses = warehousesArray.slice(0, 10);
          
          topWarehouses.forEach(warehouseName => {
            // Создаем сокращенное имя склада для заголовка
            let shortName = warehouseName.replace('СЦ ', '').split(' ')[0];
            headerRow.innerHTML += `<th title="${warehouseName}">${shortName}</th>`;
          });
          
          if (warehousesArray.length > 10) {
            headerRow.innerHTML += '<th>Другие</th>';
          }
          
          headerRow.innerHTML += '<th>Всего</th>';
          
          // Создаем и добавляем thead с заголовком
          const thead = document.createElement('thead');
          thead.appendChild(headerRow);
          warehouseHistoryTable.appendChild(thead);
          
          // Создаем tbody
          const warehouseTbody = document.createElement('tbody');
          
          // Добавляем строки с историей остатков
          warehouseDataHistory.forEach((entry) => {
            const row = document.createElement('tr');
            
            // Форматируем дату
            const date = new Date(entry.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            row.innerHTML = `<td>${formattedDate}</td>`;
            
            // Для каждого склада из топ-10 добавляем его количество
            let totalQty = 0;
            let otherWarehousesQty = 0;
            
            topWarehouses.forEach(warehouseName => {
              const qty = entry.warehouses[warehouseName] || 0;
              totalQty += qty;
              row.innerHTML += `<td>${qty}</td>`;
            });
            
            // Если есть склады помимо топ-10, группируем их в "Другие"
            if (warehousesArray.length > 10) {
              warehousesArray.slice(10).forEach(warehouseName => {
                otherWarehousesQty += entry.warehouses[warehouseName] || 0;
              });
              totalQty += otherWarehousesQty;
              row.innerHTML += `<td>${otherWarehousesQty}</td>`;
            }
            
            // Добавляем общее количество
            row.innerHTML += `<td><strong>${totalQty}</strong></td>`;
            
            warehouseTbody.appendChild(row);
          });
          
          warehouseHistoryTable.appendChild(warehouseTbody);
          warehouseHistorySection.appendChild(warehouseHistoryTable);
          historyInfo.appendChild(warehouseHistorySection);
        }
      }
      
      // Добавляем детальную историю остатков по размерам и складам
      if (sortedHistory.length > 1) {
        const sizeWarehouseHistorySection = document.createElement('div');
        sizeWarehouseHistorySection.className = 'history-section';
        
        const sizeWarehouseHistoryTitle = document.createElement('h4');
        sizeWarehouseHistoryTitle.className = 'history-title';
        sizeWarehouseHistoryTitle.textContent = 'Детальная история остатков';
        sizeWarehouseHistorySection.appendChild(sizeWarehouseHistoryTitle);
        
        // Выбор даты
        const dateSelector = document.createElement('select');
        dateSelector.className = 'date-selector';
        dateSelector.style.margin = '10px 0';
        dateSelector.style.width = '100%';
        dateSelector.style.padding = '5px';
        
        // Добавляем опции с датами
        sortedHistory.forEach((entry, index) => {
          if (!entry.savedData || !entry.savedData.sizes) return;
          
          const date = new Date(entry.date);
          const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          
          const option = document.createElement('option');
          option.value = index;
          option.textContent = formattedDate;
          dateSelector.appendChild(option);
        });
        
        sizeWarehouseHistorySection.appendChild(dateSelector);
        
        // Добавляем кнопки для переключения размера таблицы
        const tableSizeControls = document.createElement('div');
        tableSizeControls.className = 'table-size-controls';
        
        const normalSizeBtn = document.createElement('button');
        normalSizeBtn.className = 'table-size-btn active';
        normalSizeBtn.textContent = 'Обычный';
        normalSizeBtn.addEventListener('click', function() {
          this.classList.add('active');
          compactSizeBtn.classList.remove('active');
          tableContainer.classList.remove('mini-table-view');
        });
        
        const compactSizeBtn = document.createElement('button');
        compactSizeBtn.className = 'table-size-btn';
        compactSizeBtn.textContent = 'Компактный';
        compactSizeBtn.addEventListener('click', function() {
          this.classList.add('active');
          normalSizeBtn.classList.remove('active');
          tableContainer.classList.add('mini-table-view');
        });
        
        tableSizeControls.appendChild(normalSizeBtn);
        tableSizeControls.appendChild(compactSizeBtn);
        sizeWarehouseHistorySection.appendChild(tableSizeControls);
        
        // Создаем контейнер для таблицы
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        tableContainer.style.maxHeight = '300px';
        tableContainer.style.overflowY = 'auto';
        
        // Функция для отображения детальной истории по размерам и складам
        function displaySizeWarehouseHistory(historyIndex) {
          const entry = sortedHistory[historyIndex];
          if (!entry.savedData || !entry.savedData.sizes) {
            tableContainer.innerHTML = '<div class="no-data">Нет данных для выбранной даты</div>';
            return;
          }
          
          // Создаем модальное окно для детальной информации о складе
          const modalContainer = document.createElement('div');
          modalContainer.className = 'warehouse-modal-container hidden';
          modalContainer.innerHTML = `
            <div class="warehouse-modal">
              <div class="warehouse-modal-header">
                <h4>Информация о складе</h4>
                <span class="warehouse-modal-close">&times;</span>
              </div>
              <div class="warehouse-modal-content"></div>
            </div>
          `;
          tableContainer.appendChild(modalContainer);
          
          // Функция для закрытия модального окна
          function closeWarehouseModal() {
            modalContainer.classList.add('hidden');
          }
          
          // Привязываем обработчик к кнопке закрытия
          modalContainer.querySelector('.warehouse-modal-close').addEventListener('click', closeWarehouseModal);
          
          // Обработчик клика вне модального окна
          modalContainer.addEventListener('click', function(event) {
            if (event.target === modalContainer) {
              closeWarehouseModal();
            }
          });
          
          // Получаем предыдущее сохранение для сравнения
          let previousEntry = null;
          // Если у нас не первая запись в истории и есть следующая запись хронологически
          if (historyIndex < sortedHistory.length - 1) {
            previousEntry = sortedHistory[historyIndex + 1];
          }
          
          // Проверяем, существуют ли данные для сравнения
          console.log("Current entry date:", new Date(entry.date).toLocaleString());
          if (previousEntry) {
            console.log("Previous entry date:", new Date(previousEntry.date).toLocaleString());
          }
          
          // Создаем таблицу
          const table = document.createElement('table');
          table.className = 'size-warehouse-history-table';
          
          // Получаем все размеры и склады
          const sizes = Array.from(new Set(entry.savedData.sizes.map(size => size.name))).sort();
          
          // Получаем все уникальные склады для текущего сохранения
          const warehouses = new Map();
          entry.savedData.sizes.forEach(size => {
            size.stocks.forEach(stock => {
              if (!warehouses.has(stock.wh)) {
                // Получаем информацию о складе из справочника WAREHOUSES и WAREHOUSE_DETAILS
                let warehouseInfo = {
                  name: stock.name || `Склад ${stock.wh}`,
                  type: stock.type || '',
                  location: stock.location || ''
                };
                
                // Проверяем, есть ли информация о складе в глобальном справочнике
                warehouseInfo.name = getWarehouseNameById(stock.wh);
                
                // Проверяем наличие детальной информации о складе
                if (typeof WAREHOUSE_DETAILS !== 'undefined' && WAREHOUSE_DETAILS[stock.wh]) {
                  const details = WAREHOUSE_DETAILS[stock.wh];
                  if (details.name) warehouseInfo.name = details.name;
                  if (details.city) warehouseInfo.city = details.city;
                  if (details.address) warehouseInfo.location = details.address;
                  if (details.delivery_time) warehouseInfo.delivery_time = details.delivery_time;
                  if (details.is_fbw) warehouseInfo.is_fbw = details.is_fbw;
                  if (details.is_fbs) warehouseInfo.is_fbs = details.is_fbs;
                  if (details.rating) warehouseInfo.rating = details.rating;
                }
                
                warehouses.set(stock.wh, warehouseInfo);
              }
            });
          });
          
          // Создаем заголовок таблицы
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          
          // Угловая ячейка
          const cornerCell = document.createElement('th');
          cornerCell.className = 'corner';
          cornerCell.textContent = 'Склад / Размер';
          headerRow.appendChild(cornerCell);
          
          // Добавляем заголовки с размерами
          sizes.forEach(size => {
            const sizeHeader = document.createElement('th');
            sizeHeader.className = 'size-header';
            sizeHeader.textContent = size;
            headerRow.appendChild(sizeHeader);
          });
          
          thead.appendChild(headerRow);
          table.appendChild(thead);
          
          // Создаем тело таблицы
          const tbody = document.createElement('tbody');
          
          // Для каждого склада создаем строку
          warehouses.forEach((warehouseInfo, warehouseId) => {
            const row = document.createElement('tr');
            
            // Ячейка с названием склада
            const warehouseCell = document.createElement('td');
            warehouseCell.className = 'warehouse-header warehouse-tooltip';
            
            // Добавляем ID склада и полное название как всплывающую подсказку
            const warehouseIdSpan = document.createElement('span');
            const mergedInfo = getMergedWarehouseDetailsById(warehouseId);
            warehouseIdSpan.textContent = `${mergedInfo.name || warehouseInfo.name || `Склад ${warehouseId}`}`;
            warehouseIdSpan.className = 'warehouse-id-label';
            
            // Формируем расширенную подсказку
            let tooltipText = mergedInfo.name || warehouseInfo.name || `Склад ${warehouseId}`;
            tooltipText += ` (ID: ${warehouseId})`;
            const cityVal = mergedInfo.city || warehouseInfo.city;
            if (cityVal) tooltipText += `\nГород: ${cityVal}`;
            const addrVal = mergedInfo.address || warehouseInfo.location;
            if (addrVal) tooltipText += `\nАдрес: ${addrVal}`;
            const delivVal = mergedInfo.delivery_time || warehouseInfo.delivery_time;
            if (delivVal) tooltipText += `\nВремя доставки: ${delivVal} ч.`;
            
            warehouseIdSpan.title = tooltipText; // Расширенная подсказка
            
            // Добавляем иконку информации
            const infoIcon = document.createElement('span');
            infoIcon.className = 'info-icon';
            infoIcon.textContent = 'ℹ';
            
            // Обработчик клика по иконке для показа модального окна с детальной информацией
            infoIcon.addEventListener('click', function(event) {
              event.stopPropagation(); // Предотвращаем всплытие события
              
              const modalContent = modalContainer.querySelector('.warehouse-modal-content');
              modalContent.innerHTML = ''; // Очищаем содержимое
              
              // Заголовок - название склада и ID
              const warehouseTitle = document.createElement('h5');
              warehouseTitle.className = 'warehouse-modal-title';
              warehouseTitle.textContent = warehouseInfo.name || `Склад ${warehouseId}`;
              modalContent.appendChild(warehouseTitle);
              
              // ID склада
              const warehouseIdInfo = document.createElement('p');
              warehouseIdInfo.className = 'warehouse-modal-id';
              warehouseIdInfo.textContent = `ID склада: ${warehouseId}`;
              modalContent.appendChild(warehouseIdInfo);
              
              // Дополнительная информация о складе
              const additionalInfo = document.createElement('div');
              additionalInfo.className = 'warehouse-modal-additional';
              
              if (warehouseInfo.city) {
                const cityInfo = document.createElement('p');
                cityInfo.innerHTML = `<strong>Город:</strong> ${warehouseInfo.city}`;
                additionalInfo.appendChild(cityInfo);
              }
              
              if (warehouseInfo.location) {
                const locationInfo = document.createElement('p');
                locationInfo.innerHTML = `<strong>Адрес:</strong> ${warehouseInfo.location}`;
                additionalInfo.appendChild(locationInfo);
              }
              
              if (warehouseInfo.delivery_time) {
                const deliveryInfo = document.createElement('p');
                deliveryInfo.innerHTML = `<strong>Время доставки:</strong> ${warehouseInfo.delivery_time} часов`;
                additionalInfo.appendChild(deliveryInfo);
              }
              
              if (warehouseInfo.is_fbw !== undefined || warehouseInfo.is_fbs !== undefined) {
                const typeInfo = document.createElement('p');
                let typeText = '<strong>Тип:</strong> ';
                let types = [];
                
                if (warehouseInfo.is_fbw) types.push('FBW');
                if (warehouseInfo.is_fbs) types.push('FBS');
                
                typeText += types.join(', ') || 'Нет данных';
                typeInfo.innerHTML = typeText;
                additionalInfo.appendChild(typeInfo);
              }
              
              if (warehouseInfo.rating) {
                const ratingInfo = document.createElement('p');
                ratingInfo.innerHTML = `<strong>Рейтинг:</strong> ${warehouseInfo.rating}`;
                additionalInfo.appendChild(ratingInfo);
              }
              
              if (additionalInfo.childNodes.length > 0) {
                modalContent.appendChild(additionalInfo);
              }
              
              // Информация о доступности размеров на этом складе
              const sizesInfo = document.createElement('div');
              sizesInfo.className = 'warehouse-modal-sizes';
              
              const sizesTitle = document.createElement('h6');
              sizesTitle.textContent = 'Наличие по размерам:';
              sizesInfo.appendChild(sizesTitle);
              
              const sizesList = document.createElement('ul');
              
              // Получаем данные о наличии размеров на этом складе
              let hasAnySizes = false;
              sizes.forEach(sizeName => {
                const sizeData = entry.savedData.sizes.find(s => s.name === sizeName);
                if (sizeData) {
                  const stockData = sizeData.stocks.find(s => s.wh === warehouseId);
                  if (stockData && stockData.qty > 0) {
                    hasAnySizes = true;
                    const sizeItem = document.createElement('li');
                    sizeItem.innerHTML = `<span class="size-name">${sizeName}</span>: <span class="size-qty">${stockData.qty}</span>`;
                    sizesList.appendChild(sizeItem);
                  }
                }
              });
              
              if (!hasAnySizes) {
                const noSizesInfo = document.createElement('p');
                noSizesInfo.className = 'no-sizes';
                noSizesInfo.textContent = 'Нет доступных размеров на данном складе';
                sizesInfo.appendChild(noSizesInfo);
              } else {
                sizesInfo.appendChild(sizesList);
              }
              
              modalContent.appendChild(sizesInfo);
              
              // Показываем модальное окно
              modalContainer.classList.remove('hidden');
            });
            
            warehouseCell.appendChild(warehouseIdSpan);
            warehouseCell.appendChild(infoIcon);
            
            row.appendChild(warehouseCell);
            
            // Для каждого размера добавляем количество
            sizes.forEach(sizeName => {
              const cell = document.createElement('td');
              
              // Ищем размер
              const sizeData = entry.savedData.sizes.find(s => s.name === sizeName);
              if (sizeData) {
                // Ищем склад для этого размера
                const stockData = sizeData.stocks.find(s => s.wh === warehouseId);
                if (stockData) {
                  // Текущее количество
                  const currentQty = stockData.qty;
                  let dynIcon = '';
                  let dynClass = '';
                  
                  // Проверяем наличие предыдущих данных для сравнения
                  if (previousEntry && previousEntry.savedData && previousEntry.savedData.sizes) {
                    const prevSizeData = previousEntry.savedData.sizes.find(s => s.name === sizeName);
                    if (prevSizeData) {
                      const prevStockData = prevSizeData.stocks.find(s => s.wh === warehouseId);
                      if (prevStockData) {
                        const prevQty = prevStockData.qty;
                        
                        if (currentQty > prevQty) {
                          dynIcon = '▲'; // Заменяем на заполненную стрелку вверх
                          dynClass = 'price-down'; // Используем существующий класс (зеленый)
                        } else if (currentQty < prevQty) {
                          dynIcon = '▼'; // Заменяем на заполненную стрелку вниз
                          dynClass = 'price-up'; // Используем существующий класс (красный)
                        } else {
                          dynIcon = '●'; // Заменяем на точку (без изменений)
                          dynClass = 'price-same'; // Используем существующий класс (серый)
                        }
                      } else {
                        // Размер был, но склада не было
                        dynIcon = '✚'; // Заменяем на плюс
                        dynClass = 'price-down'; // Зеленый
                      }
                    } else {
                      // Нового размера не было
                      dynIcon = '✚'; // Заменяем на плюс
                      dynClass = 'price-down'; // Зеленый
                    }
                  } else {
                    // Нет предыдущих данных
                    dynIcon = '●'; // Заменяем на точку для первого сохранения
                    dynClass = 'price-same';
                  }
                  
                  // Создаем видимый индикатор изменения
                  const indicator = document.createElement('span');
                  indicator.className = `change-indicator ${dynClass}`;
                  indicator.textContent = dynIcon;
                  
                  // Очищаем ячейку и добавляем текст + индикатор
                  cell.textContent = currentQty;
                  cell.appendChild(indicator);
                  
                  // Цветовая индикация в зависимости от количества
                  if (currentQty > 10) {
                    cell.style.color = 'var(--success-color)';
                    cell.style.fontWeight = '600';
                  } else if (currentQty > 0) {
                    cell.style.color = 'var(--warning-color)';
                    cell.style.fontWeight = '600';
                  } else {
                    cell.style.color = 'var(--light-text)';
                  }
                } else {
                  // Размер есть, но склада нет
                  let dynIcon = '';
                  let dynClass = '';
                  
                  // Проверяем, был ли этот склад для этого размера раньше
                  if (previousEntry && previousEntry.savedData && previousEntry.savedData.sizes) {
                    const prevSizeData = previousEntry.savedData.sizes.find(s => s.name === sizeName);
                    if (prevSizeData) {
                      const prevStockData = prevSizeData.stocks.find(s => s.wh === warehouseId);
                      if (prevStockData && prevStockData.qty > 0) {
                        dynIcon = '▼'; // Стрелка вниз (было и исчезло)
                        dynClass = 'price-up'; // Красный
                        
                        // Создаем видимый индикатор изменения
                        const indicator = document.createElement('span');
                        indicator.className = `change-indicator ${dynClass}`;
                        indicator.textContent = dynIcon;
                        
                        cell.textContent = '0 ';
                        cell.appendChild(indicator);
                      } else {
                        cell.textContent = '0';
                      }
                    } else {
                      cell.textContent = '0';
                    }
                  } else {
                    cell.textContent = '0';
                  }
                  
                  cell.style.color = 'var(--light-text)';
                }
              } else {
                // Размера нет совсем
                let dynIcon = '';
                let dynClass = '';
                
                // Проверяем, был ли этот размер раньше
                if (previousEntry && previousEntry.savedData && previousEntry.savedData.sizes) {
                  const prevSizeData = previousEntry.savedData.sizes.find(s => s.name === sizeName);
                  if (prevSizeData) {
                    const prevStockData = prevSizeData.stocks.find(s => s.wh === warehouseId);
                    if (prevStockData && prevStockData.qty > 0) {
                      dynIcon = '▼'; // Стрелка вниз (было и исчезло)
                      dynClass = 'price-up'; // Красный
                      
                      // Создаем видимый индикатор изменения
                      const indicator = document.createElement('span');
                      indicator.className = `change-indicator ${dynClass}`;
                      indicator.textContent = dynIcon;
                      
                      cell.textContent = '- ';
                      cell.appendChild(indicator);
                    } else {
                      cell.textContent = '-';
                    }
                  } else {
                    cell.textContent = '-';
                  }
                } else {
                  cell.textContent = '-';
                }
                
                cell.style.color = 'var(--light-text)';
              }
              
              row.appendChild(cell);
            });
            
            tbody.appendChild(row);
          });
          
          table.appendChild(tbody);
          tableContainer.innerHTML = '';
          tableContainer.appendChild(table);
        }
        
        // Обработчик изменения выбранной даты
        dateSelector.addEventListener('change', function() {
          displaySizeWarehouseHistory(parseInt(this.value));
        });
        
        sizeWarehouseHistorySection.appendChild(tableContainer);
        historyInfo.appendChild(sizeWarehouseHistorySection);
        
        // Отображаем данные для первой даты
        if (dateSelector.options.length > 0) {
          displaySizeWarehouseHistory(0);
        }
      }
      
      // Добавляем информацию о дате первого сохранения
      if (savedProduct.firstSaved) {
        const firstSavedDate = new Date(savedProduct.firstSaved);
        const formattedFirstSaved = `${firstSavedDate.toLocaleDateString()} ${firstSavedDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        
        const savedInfo = document.createElement('div');
        savedInfo.className = 'saved-info';
        savedInfo.innerHTML = `<p>Товар впервые сохранен: ${formattedFirstSaved}</p>`;
        
        historyInfo.appendChild(savedInfo);
      }
      
      // Добавляем информацию о количестве сохранений
      const savesCount = savedProduct.priceHistory.length;
      const savesInfo = document.createElement('div');
      savesInfo.className = 'saves-info';
      savesInfo.innerHTML = `<p>Всего сохранений: ${savesCount}</p>`;
      
      historyInfo.appendChild(savesInfo);
    });
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

  // Вкладка складов удалена
  /* function displayWarehouseData() {
    // Очищаем текущий список складов
    warehouseList.innerHTML = '';
    
    // Получаем значение для поиска
    const searchText = warehouseSearch.value.toLowerCase();
    
    // Получаем выбранный метод сортировки
    const sortBy = warehouseSort.value;
    
    // Получаем значения фильтров
    const showFBW = filterFBW.checked;
    const showFBS = filterFBS.checked;
    
    // Строим объединённый каталог складов из статичного справочника и acceptance-отчёта
    const ids = new Set([
      ...Object.keys(typeof WAREHOUSE_DETAILS !== 'undefined' ? WAREHOUSE_DETAILS : {}),
      ...Object.keys(ACCEPTANCE_DATA || {})
    ]);
    let warehouses = Array.from(ids).map(id => getMergedWarehouseDetailsById(id));
    
    // Применяем фильтр по типу склада
    if (!(showFBW && showFBS)) {
      warehouses = warehouses.filter(warehouse => {
        const isFbw = Boolean(warehouse.is_fbw);
        const isFbs = Boolean(warehouse.is_fbs);
        return (showFBW && isFbw) || (showFBS && isFbs);
      });
    }
    
    // Применяем фильтр по поисковому запросу
    if (searchText) {
      warehouses = warehouses.filter(warehouse => {
        const name = (warehouse.name || '').toLowerCase();
        const city = (warehouse.city || '').toLowerCase();
        const addr = (warehouse.address || '').toLowerCase();
        return name.includes(searchText) || city.includes(searchText) || addr.includes(searchText);
      });
    }
    
    // Применяем сортировку
    switch (sortBy) {
      case 'name':
        warehouses.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'delivery':
        warehouses.sort((a, b) => {
          const aDelivery = parseInt(a.delivery_time) || inferDeliveryFromAcceptance(a.id) || 999;
          const bDelivery = parseInt(b.delivery_time) || inferDeliveryFromAcceptance(b.id) || 999;
          return aDelivery - bDelivery;
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
    // Вкладка складов удалена
    
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
      let deliveryTime = parseInt(warehouse.delivery_time) || inferDeliveryFromAcceptance(warehouse.id);
        
        if (!deliveryTime) {
          // если в статике нет, попробуем оценить по коэффициентам приёмки
          const merged = getMergedWarehouseDetailsById(warehouse.id);
          const acceptance = merged.acceptance;
          const type4 = acceptance && (acceptance.types && (acceptance.types['4'] || acceptance.types[4]));
          const type6 = acceptance && (acceptance.types && (acceptance.types['6'] || acceptance.types[6]));
          const anyCoeff = (type4 && parseInt(type4.deliveryCoefficient)) || (type6 && parseInt(type6.deliveryCoefficient));
          if (anyCoeff) deliveryTime = anyCoeff; // используем коэффициент как суррогат времени доставки
        }
        
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
          <h4>${getWarehouseNameById(warehouse.id)}</h4>
          <div class="warehouse-id">ID: ${warehouse.id}</div>
          
          <div class="material-quality">
            Рейтинг: ${warehouse.rating}
          </div>
          
          <div class="warehouse-info-item">
            <span>Доставка:</span>
            <span class="${deliveryClass}">${warehouse.delivery_time ? warehouse.delivery_time + ' ч' : 'нет данных'}</span>
          </div>
          
          <div class="warehouse-type">
            ${getMergedWarehouseDetailsById(warehouse.id).is_fbw ? '<span class="warehouse-type-tag tag-fbw">FBW</span>' : ''}
            ${getMergedWarehouseDetailsById(warehouse.id).is_fbs ? '<span class="warehouse-type-tag tag-fbs">FBS</span>' : ''}
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
  } */

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
    historyInfo.innerHTML = '';
    
    // Сбрасываем состояние кнопки избранного
    addToFavoritesBtn.classList.remove('active');
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
  
  // Функция для отображения опций синхронизации
  function showSyncOptions() {
    // Получаем контейнер опций и очищаем его
    const syncOptionsContainer = document.querySelector('.sync-options');
    const syncItemsContainer = document.querySelector('.sync-items-container');
    syncItemsContainer.innerHTML = '';
    
    // Если нет избранных товаров
    if (favoriteProducts.length === 0) {
      alert('Нет избранных товаров для синхронизации.');
      return;
    }
    
    // Показываем контейнер опций
    syncOptionsContainer.classList.remove('hidden');
    
    // Создаем элементы для каждого избранного товара
    favoriteProducts.forEach(product => {
      const syncItem = document.createElement('div');
      syncItem.className = 'sync-item';
      syncItem.innerHTML = `
        <input type="checkbox" class="sync-item-checkbox" data-id="${product.id}" checked>
        <div class="sync-item-info">
          <div class="sync-item-name">${product.name}</div>
          <div class="sync-item-brand">${product.brand}</div>
        </div>
      `;
      syncItemsContainer.appendChild(syncItem);
    });
    
    // Добавляем обработчики событий для кнопок
    document.getElementById('selectAllBtn').addEventListener('click', () => {
      document.querySelectorAll('.sync-item-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
    });
    
    document.getElementById('deselectAllBtn').addEventListener('click', () => {
      document.querySelectorAll('.sync-item-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
    });
    
    document.getElementById('startSyncBtn').addEventListener('click', () => {
      const selectedIds = Array.from(document.querySelectorAll('.sync-item-checkbox:checked'))
        .map(checkbox => checkbox.getAttribute('data-id'));
      
      if (selectedIds.length === 0) {
        alert('Выберите хотя бы один товар для синхронизации.');
        return;
      }
      
      // Запускаем синхронизацию выбранных товаров
      syncSelectedFavorites(selectedIds);
      
      // Скрываем панель опций
      syncOptionsContainer.classList.add('hidden');
    });
    
    document.getElementById('cancelSyncBtn').addEventListener('click', () => {
      syncOptionsContainer.classList.add('hidden');
    });
  }
  
  // Функция синхронизации избранного
  async function syncFavorites() {
    // Показываем панель выбора товаров для синхронизации
    showSyncOptions();
  }
  
  // Функция синхронизации выбранных избранных товаров
  async function syncSelectedFavorites(selectedIds) {
    // Фильтруем список избранных товаров по выбранным ID
    const productsToSync = favoriteProducts.filter(product => selectedIds.includes(product.id.toString()));
    
    // Если нет товаров для синхронизации
    if (productsToSync.length === 0) {
      alert('Нет избранных товаров для синхронизации.');
      return;
    }
    
    // Изменяем состояние кнопки
    syncFavoritesBtn.classList.add('syncing');
    syncFavoritesBtn.disabled = true;
    
    // Создаем переменную для отслеживания прогресса синхронизации
    let syncedCount = 0;
    const totalCount = productsToSync.length;
    
    // Создаем массив ошибок при синхронизации
    const errors = [];
    
    // Последовательно обрабатываем каждый товар
    for (const product of productsToSync) {
      try {
        // Обновляем состояние кнопки с прогрессом
        syncFavoritesBtn.setAttribute('title', `Синхронизация (${syncedCount + 1}/${totalCount})...`);
        
        // Получаем полные данные о товаре
        await new Promise((resolve, reject) => {
          const apiUrl = buildV4DetailUrl([product.id]);
          
          fetch(apiUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
              }
              return response.json();
            })
            .then(data => {
              const products = (data && data.data && data.data.products) ? data.data.products : data.products;
              if (!products || products.length === 0) {
                throw new Error(`Товар не найден: ${product.id}`);
              }
              
              const fullProduct = products[0];
              
              // Сохраняем товар в историю
              chrome.storage.local.get({ savedProducts: [] }, (result) => {
                const savedProducts = result.savedProducts;
                
                // Проверяем, существует ли уже такой артикул
                const existingIndex = savedProducts.findIndex(p => p.id === fullProduct.id);
                
                // Текущая дата для истории
                const currentDate = new Date().toISOString();
              const currentPrice = getProductPriceInfo(fullProduct).salePriceU / 100;
                
                if (existingIndex !== -1) {
                  // Обновляем существующий товар
                  // Добавляем информацию о цене в историю
                  if (!savedProducts[existingIndex].priceHistory) {
                    savedProducts[existingIndex].priceHistory = [];
                  }
                  
                  // Добавляем новую запись в историю цен
                  savedProducts[existingIndex].priceHistory.push({
                    date: currentDate,
                    price: currentPrice,
                    savedData: {
                      // Добавляем ключевые данные для отслеживания истории
                      feedbacks: fullProduct.feedbacks,
                      sizes: fullProduct.sizes
                    }
                  });
                  
                  // Добавляем информацию об отзывах в историю
                  if (!savedProducts[existingIndex].feedbacksHistory) {
                    savedProducts[existingIndex].feedbacksHistory = [];
                  }
                  
                  savedProducts[existingIndex].feedbacksHistory.push({
                    date: currentDate,
                    count: fullProduct.feedbacks
                  });
                  
                  // Обновляем данные товара
                  savedProducts[existingIndex] = {
                    ...fullProduct,
                    priceHistory: savedProducts[existingIndex].priceHistory,
                    feedbacksHistory: savedProducts[existingIndex].feedbacksHistory,
                    lastUpdated: currentDate
                  };
                } else {
                  // Добавляем новый товар
                  savedProducts.push({
                    ...fullProduct,
                    priceHistory: [{
                      date: currentDate,
                      price: currentPrice,
                      savedData: {
                        // Добавляем ключевые данные для отслеживания истории
                        feedbacks: fullProduct.feedbacks,
                        sizes: fullProduct.sizes
                      }
                    }],
                    feedbacksHistory: [{
                      date: currentDate,
                      count: fullProduct.feedbacks
                    }],
                    firstSaved: currentDate,
                    lastUpdated: currentDate
                  });
                }
                
                chrome.storage.local.set({ savedProducts }, () => {
                  syncedCount++;
                  resolve();
                });
              });
            })
            .catch(error => {
              console.error(`Ошибка при синхронизации товара ${product.id}:`, error);
              errors.push({
                id: product.id,
                name: product.name,
                error: error.message
              });
              resolve(); // Продолжаем синхронизацию, даже если произошла ошибка
            });
        });
        
        // Добавляем небольшую задержку между запросами, чтобы не перегружать сервер
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Ошибка при синхронизации товара ${product.id}:`, error);
        errors.push({
          id: product.id,
          name: product.name,
          error: error.message
        });
      }
    }
    
    // Восстанавливаем состояние кнопки
    syncFavoritesBtn.classList.remove('syncing');
    syncFavoritesBtn.disabled = false;
    syncFavoritesBtn.setAttribute('title', 'Синхронизировать историю избранных товаров');
    
    // Показываем сообщение о завершении синхронизации
    if (errors.length === 0) {
      alert(`Синхронизация завершена. Сохранено ${syncedCount} товаров.`);
    } else {
      alert(`Синхронизация завершена с ошибками. Сохранено ${syncedCount} из ${totalCount} товаров. Не удалось сохранить ${errors.length} товаров.`);
      console.error('Товары с ошибками:', errors);
    }
  }
}); // Закрывающая скобка обработчика DOMContentLoaded 