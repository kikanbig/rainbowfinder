/**
 * Тестовый скрипт для проверки API ключа OpenWeatherMap
 * 
 * Запуск: node test-api.js
 */

const API_KEY = 'be314fc63d2ce6bc8c976a4e60be8955';

// Тестируем API для Москвы
const testCoords = {
  lat: 55.7558,  // Москва
  lon: 37.6176
};

async function testWeatherAPI() {
  console.log('🌈 Тестирование API ключа OpenWeatherMap...\n');

  try {
    // Тест 1: Текущая погода
    console.log('📍 Тестируем текущую погоду для Москвы...');
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${testCoords.lat}&lon=${testCoords.lon}&appid=${API_KEY}&units=metric&lang=ru`;
    
    const currentResponse = await fetch(currentWeatherUrl);
    
    if (!currentResponse.ok) {
      throw new Error(`HTTP ${currentResponse.status}: ${currentResponse.statusText}`);
    }
    
    const currentData = await currentResponse.json();
    
    console.log('✅ Текущая погода получена успешно!');
    console.log(`   Город: ${currentData.name}`);
    console.log(`   Температура: ${currentData.main.temp}°C`);
    console.log(`   Описание: ${currentData.weather[0].description}`);
    console.log(`   Влажность: ${currentData.main.humidity}%`);
    console.log(`   Видимость: ${currentData.visibility / 1000}км`);
    console.log(`   Облачность: ${currentData.clouds.all}%\n`);

    // Тест 2: Качество воздуха
    console.log('🌬️ Тестируем качество воздуха...');
    const airQualityUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${testCoords.lat}&lon=${testCoords.lon}&appid=${API_KEY}`;
    
    const airResponse = await fetch(airQualityUrl);
    
    if (!airResponse.ok) {
      console.log('⚠️ Качество воздуха недоступно (не критично)');
    } else {
      const airData = await airResponse.json();
      console.log('✅ Качество воздуха получено успешно!');
      console.log(`   Индекс качества воздуха: ${airData.list[0].main.aqi}/5\n`);
    }

    // Проверяем условия для радуги
    console.log('🌈 Анализируем условия для радуги...');
    
    const now = new Date();
    const hour = now.getHours();
    const sunAngle = calculateApproxSunAngle(hour);
    
    console.log(`   Примерный угол солнца: ${sunAngle}°`);
    console.log(`   Оптимальный угол для радуги: < 42°`);
    
    const rainCondition = currentData.weather[0].main.includes('Rain') || 
                         currentData.weather[0].main.includes('Drizzle') ||
                         currentData.main.humidity > 80;
    
    const visibilityCondition = currentData.visibility > 5000; // > 5км
    const sunAngleCondition = sunAngle < 42 && sunAngle > 0;
    
    console.log(`   Водяные капли: ${rainCondition ? '✅' : '❌'} (дождь/высокая влажность)`);
    console.log(`   Видимость: ${visibilityCondition ? '✅' : '❌'} (> 5км)`);
    console.log(`   Угол солнца: ${sunAngleCondition ? '✅' : '❌'} (0° < угол < 42°)`);
    
    const rainbowPossible = rainCondition && visibilityCondition && sunAngleCondition;
    
    console.log(`\n🎯 Радуга сейчас возможна: ${rainbowPossible ? '✅ ДА!' : '❌ НЕТ'}`);
    
    if (rainbowPossible) {
      console.log('🌈 Отличные условия! Посмотрите в сторону противоположную солнцу!');
    } else {
      console.log('⏳ Дождитесь изменения погодных условий или времени суток');
    }

  } catch (error) {
    console.error('❌ Ошибка при тестировании API:');
    
    if (error.message.includes('401')) {
      console.error('   🔑 Проблема с API ключом:');
      console.error('   - Проверьте правильность ключа');
      console.error('   - API ключ может активироваться до 2 часов');
      console.error('   - Убедитесь, что подписка активна');
    } else if (error.message.includes('403')) {
      console.error('   🚫 Доступ запрещен:');
      console.error('   - Возможно превышен лимит запросов');
      console.error('   - Проверьте тарифный план');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('   🌐 Проблемы с сетью:');
      console.error('   - Проверьте подключение к интернету');
      console.error('   - Возможно проблемы с DNS');
    } else {
      console.error(`   📋 Детали ошибки: ${error.message}`);
    }
  }
}

// Примерный расчет угла солнца на основе времени (упрощенный)
function calculateApproxSunAngle(hour) {
  // Упрощенный расчет только для демонстрации
  // В реальном приложении используются точные астрономические формулы
  
  if (hour < 6 || hour > 20) return -10; // Ночь
  if (hour >= 11 && hour <= 13) return 60; // Полдень - высокое солнце
  if (hour >= 6 && hour <= 8) return 20;   // Утро - хорошо для радуги
  if (hour >= 18 && hour <= 20) return 25; // Вечер - хорошо для радуги
  return 45; // День - слишком высоко
}

console.log('🚀 Запуск тестирования...\n');
console.log(`🔑 Используемый API ключ: ${API_KEY.substring(0, 8)}...${API_KEY.substring(-4)}`);
console.log(`📍 Тестовая локация: Москва (${testCoords.lat}, ${testCoords.lon})\n`);

testWeatherAPI(); 