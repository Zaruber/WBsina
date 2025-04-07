import json
import csv
import os

def analyze_json_structure(json_file_path):
    """Анализирует структуру JSON-файла и пытается найти список складов"""
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Проверяем, является ли корневой элемент списком
    if isinstance(data, list):
        # Проверяем первый элемент на наличие характерных полей склада
        if data and 'warehouse' in data[0] and 'origid' in data[0]:
            print(f"Найден список складов в корне JSON. Всего: {len(data)}")
            return data
    
    # Проверяем основные поля на верхнем уровне
    for key in data.keys():
        print(f"Найден ключ верхнего уровня: {key}")
        
        # Если значение - список, проверяем первый элемент
        if isinstance(data[key], list):
            if data[key] and 'warehouse' in data[key][0] and 'origid' in data[key][0]:
                print(f"Найден список складов в поле '{key}'. Всего: {len(data[key])}")
                return data[key]
        
        # Если значение - словарь, проверяем его ключи
        elif isinstance(data[key], dict):
            for subkey in data[key].keys():
                print(f"Найден ключ второго уровня: {key}.{subkey}")
                
                # Если значение - список, проверяем первый элемент
                if isinstance(data[key][subkey], list):
                    if data[key][subkey] and 'warehouse' in data[key][subkey][0] and 'origid' in data[key][subkey][0]:
                        print(f"Найден список складов в поле '{key}.{subkey}'. Всего: {len(data[key][subkey])}")
                        return data[key][subkey]
    
    # Если не удалось найти автоматически, просим пользователя указать
    print("Не удалось автоматически определить путь к списку складов.")
    print("Пожалуйста, проверьте структуру файла и укажите путь вручную в скрипте.")
    return None

def parse_warehouses(json_file_path):
    # Открываем JSON-файл
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Ручное указание пути к складам на основе структуры вашего файла
    if 'result' in data and 'resp' in data['result']:
        # Проверяем, содержит ли result.resp список складов
        if isinstance(data['result']['resp'], list):
            warehouses = data['result']['resp']
            print(f"Найден список в 'result.resp'. Элементов: {len(warehouses)}")
            
            # Проверяем, похожи ли элементы на склады
            if warehouses and 'warehouse' in warehouses[0]:
                print(f"Определено как список складов. Найдено {len(warehouses)} складов.")
            else:
                print("Список найден, но не похож на список складов. Продолжаем поиск...")
                # Проверяем первый элемент списка
                if warehouses and isinstance(warehouses[0], dict):
                    print(f"Первый элемент содержит ключи: {list(warehouses[0].keys())[:5]}...")
                warehouses = None
        # Если result.resp - словарь, ищем в нем список складов
        elif isinstance(data['result']['resp'], dict):
            print("'result.resp' является словарем, ищем в нем списки...")
            for key in data['result']['resp'].keys():
                print(f"Проверяем ключ: {key}")
                if isinstance(data['result']['resp'][key], list) and data['result']['resp'][key]:
                    print(f"Найден список в 'result.resp.{key}'. Элементов: {len(data['result']['resp'][key])}")
                    
                    # Если это список объектов с нужными полями, считаем его списком складов
                    if 'warehouse' in data['result']['resp'][key][0] or 'origid' in data['result']['resp'][key][0]:
                        warehouses = data['result']['resp'][key]
                        print(f"Определено как список складов. Найдено {len(warehouses)} складов.")
                        break
            else:
                warehouses = None
                print("Не удалось найти список складов в result.resp")
        else:
            warehouses = None
            print("result.resp не является ни списком, ни словарем")
    else:
        print("Структура отличается от ожидаемой")
        warehouses = None
    
    if not warehouses:
        print("Не удалось найти список складов. Выводим структуру данных для ручного анализа:")
        print_structure(data)
        return []
    
    # Создаем список для хранения информации о складах
    warehouses_info = []
    
    # Проходим по каждому складу
    for warehouse in warehouses:
        # Извлекаем нужные поля
        warehouse_info = {
            'id': warehouse.get('origid', ''),  # Используем origid как основной ID
            'name': warehouse.get('warehouse', ''),
            'delivery_time': warehouse.get('deliveryPeriodToShelf', '').replace(' ч.', ''),  # Убираем " ч." из времени
            'address': warehouse.get('address', ''),
            'latitude': warehouse.get('latitude', ''),
            'longitude': warehouse.get('longitude', ''),
            'is_fbw': warehouse.get('isFbw', False),
            'is_fbs': warehouse.get('isFbs', False),
            'rating': warehouse.get('rating', 0),
            'near_city': warehouse.get('nearCity', {}).get('title', '') if warehouse.get('nearCity') else ''
        }
        warehouses_info.append(warehouse_info)
    
    return warehouses_info

# Функция для вывода структуры JSON для ручного анализа
def print_structure(data, prefix='', max_level=3, current_level=0):
    """Печатает структуру данных JSON для ручного анализа"""
    if current_level >= max_level:
        print(f"{prefix}... (глубина ограничена)")
        return
        
    if isinstance(data, dict):
        for key, value in list(data.items())[:5]:  # Ограничиваем 5 ключами для краткости
            print(f"{prefix}{key}: {type(value).__name__}")
            if isinstance(value, (dict, list)):
                print_structure(value, prefix + '  ', max_level, current_level + 1)
    elif isinstance(data, list) and len(data) > 0:
        print(f"{prefix}[список из {len(data)} элементов]")
        if len(data) > 0:
            print(f"{prefix}Первый элемент:")
            print_structure(data[0], prefix + '  ', max_level, current_level + 1)

# Сохраняем информацию в различных форматах
def save_to_js(warehouses_info, js_file_path):
    """Сохраняет информацию в формате JavaScript объекта для использования в расширении"""
    with open(js_file_path, 'w', encoding='utf-8') as f:
        f.write('const WAREHOUSES = {\n')
        for warehouse in warehouses_info:
            f.write(f'  "{warehouse["id"]}": "{warehouse["name"]}",\n')
        f.write('};\n\n')
        
        f.write('const WAREHOUSE_DETAILS = {\n')
        for warehouse in warehouses_info:
            f.write(f'  "{warehouse["id"]}": {{\n')
            f.write(f'    "name": "{warehouse["name"]}",\n')
            f.write(f'    "delivery_time": "{warehouse["delivery_time"]}",\n')
            f.write(f'    "address": "{warehouse["address"]}",\n')
            f.write(f'    "coords": [{warehouse["latitude"]}, {warehouse["longitude"]}],\n')
            f.write(f'    "is_fbw": {"true" if warehouse["is_fbw"] else "false"},\n')
            f.write(f'    "is_fbs": {"true" if warehouse["is_fbs"] else "false"},\n')
            f.write(f'    "rating": {warehouse["rating"]},\n')
            f.write(f'    "city": "{warehouse["near_city"]}"\n')
            f.write('  },\n')
        f.write('};')

def save_to_csv(warehouses_info, csv_file_path):
    """Сохраняет информацию в CSV-файл для дальнейшего анализа"""
    with open(csv_file_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=warehouses_info[0].keys())
        writer.writeheader()
        writer.writerows(warehouses_info)

# Основная функция
def main():
    json_file_path = 'GetAllWarehouse.json'
    js_file_path = 'enhanced_warehouses.js'
    csv_file_path = 'warehouses_data.csv'
    
    # Проверяем существование файла
    if not os.path.exists(json_file_path):
        print(f"Ошибка: Файл {json_file_path} не найден!")
        return
    
    try:
        warehouses_info = parse_warehouses(json_file_path)
        if warehouses_info:
            save_to_js(warehouses_info, js_file_path)
            save_to_csv(warehouses_info, csv_file_path)
            print(f"Обработано {len(warehouses_info)} складов.")
            print(f"Данные сохранены в {js_file_path} и {csv_file_path}")
    except Exception as e:
        print(f"Произошла ошибка: {e}")

if __name__ == "__main__":
    main()