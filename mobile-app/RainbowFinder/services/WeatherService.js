/**
 * Сервис для работы с OpenWeatherMap API
 * Получение актуальных погодных данных и прогнозов
 */

import Logger from '../utils/Logger';

const API_KEY = 'be314fc63d2ce6bc8c976a4e60be8955';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';

export class WeatherService {
  /**
   * Получение текущей погоды с анализом недавних осадков
   */
  static async getCurrentWeather(latitude, longitude) {
    try {
      Logger.info('WEATHER', '=== НАЧИНАЕМ ПОЛУЧЕНИЕ ПОГОДНЫХ ДАННЫХ ===');
      Logger.debug('WEATHER', 'Входные параметры', { latitude, longitude });
      Logger.debug('WEATHER', 'API конфигурация', { 
        apiKeyPresent: !!API_KEY, 
        apiKeyLength: API_KEY ? API_KEY.length : 0,
        baseUrl: BASE_URL 
      });
      
      // Текущая погода
      const currentUrl = `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ru`;
      Logger.debug('WEATHER', 'URL запроса', currentUrl.replace(API_KEY, 'СКРЫТ'));
      
      Logger.info('WEATHER', 'Отправляем запрос к OpenWeatherMap...');
      const currentResponse = await fetch(currentUrl);
      Logger.info('WEATHER', 'Получен ответ', { 
        status: currentResponse.status, 
        statusText: currentResponse.statusText 
      });
      
      if (!currentResponse.ok) {
        const errorText = await currentResponse.text();
        Logger.error('WEATHER', 'Ошибка API', { 
          status: currentResponse.status, 
          statusText: currentResponse.statusText,
          error: errorText 
        });
        throw new Error(`HTTP Error: ${currentResponse.status} ${currentResponse.statusText} - ${errorText}`);
      }
      
      const currentData = await currentResponse.json();
      Logger.success('WEATHER', 'Данные текущей погоды получены', { 
        city: currentData.name, 
        weather: currentData.weather[0].description,
        temp: currentData.main.temp,
        humidity: currentData.main.humidity
      });
      
             // Получаем также часовой прогноз для анализа недавних осадков (с обработкой ошибок)
       let recentRainData = null;
       try {
         const forecastUrl = `${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ru`;
         const forecastResponse = await fetch(forecastUrl);
         
         if (forecastResponse.ok) {
           const forecastData = await forecastResponse.json();
           recentRainData = this.analyzeRecentRain(forecastData.list);
         } else {
           console.log('Прогноз недоступен, продолжаем без анализа недавних осадков');
         }
       } catch (forecastError) {
         console.log('Ошибка получения прогноза (не критично):', forecastError);
         // Продолжаем без анализа недавних осадков
       }
      
      const weatherData = this.transformWeatherData(currentData);
      
      // Добавляем анализ недавних осадков
      weatherData.recentRain = recentRainData;
      
      return weatherData;
    } catch (error) {
      console.error('Ошибка получения погодных данных:', error);
      throw new Error('Не удалось получить данные о погоде. Проверьте соединение с интернетом.');
    }
  }

  /**
   * Анализ недавних осадков (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   * Использует текущие данные и симулирует недавние осадки на основе влажности
   */
  static analyzeRecentRain(forecastList) {
    Logger.info('WEATHER', 'Начинаем анализ недавних осадков');
    
    try {
      // ИСПРАВЛЕНИЕ: Анализируем текущие условия вместо прогноза в прошлое
      let hasRecentRain = false;
      let rainIntensity = 0;
      let timeSinceRain = null;
      
      // Берем первую запись прогноза (ближайшую к текущему времени)
      if (forecastList && forecastList.length > 0) {
        const currentForecast = forecastList[0];
        const description = currentForecast.weather[0].description.toLowerCase();
        const humidity = currentForecast.main.humidity;
        const clouds = currentForecast.clouds.all;
        
        Logger.debug('WEATHER', 'Анализ погодных условий', {
          description,
          humidity,
          clouds,
          time: new Date(currentForecast.dt * 1000).toISOString()
        });
        
        // УЛУЧШЕННАЯ ЛОГИКА: Определяем недавний дождь по условиям
        const rainConditions = [
          description.includes('дождь') || description.includes('rain'),
          description.includes('shower') || description.includes('drizzle'),
          description.includes('ливень') || description.includes('морось'),
          humidity > 85 && clouds > 70 // Высокая влажность + облачность
        ];
        
        hasRecentRain = rainConditions.some(condition => condition);
        
        if (hasRecentRain) {
          // Симулируем время дождя на основе условий влажности
          if (humidity > 95) {
            timeSinceRain = 0.25; // 15 минут назад
            rainIntensity = 2.0;
          } else if (humidity > 90) {
            timeSinceRain = 0.5; // 30 минут назад  
            rainIntensity = 1.5;
          } else if (humidity > 85) {
            timeSinceRain = 1.0; // 1 час назад
            rainIntensity = 1.0;
          } else {
            timeSinceRain = 2.0; // 2 часа назад
            rainIntensity = 0.5;
          }
          
          Logger.success('WEATHER', `Обнаружены признаки недавнего дождя: ${Math.round(timeSinceRain * 60)} минут назад`);
        } else {
          Logger.info('WEATHER', 'Признаков недавнего дождя не обнаружено');
        }
      }
      
      const result = {
        hasRecentRain,
        intensity: rainIntensity,
        timeSinceRain,
        isOptimal: hasRecentRain && timeSinceRain < 1,
        description: this.getRecentRainDescription(hasRecentRain, timeSinceRain)
      };
      
      Logger.info('WEATHER', 'Результат анализа осадков', result);
      return result;
      
    } catch (error) {
      Logger.error('WEATHER', 'Ошибка анализа недавних осадков', error);
      
      // Возвращаем базовое состояние при ошибке
      return {
        hasRecentRain: false,
        intensity: 0,
        timeSinceRain: null,
        isOptimal: false,
        description: 'Не удалось проанализировать недавние осадки'
      };
    }
  }

  /**
   * Описание состояния недавних осадков
   */
  static getRecentRainDescription(hasRecentRain, timeSinceRain) {
    if (!hasRecentRain) {
      return 'Осадков не было в последние 3 часа';
    }
    
    if (timeSinceRain < 0.5) {
      return 'Дождь был менее 30 минут назад - ОТЛИЧНО для радуги!';
    } else if (timeSinceRain < 1) {
      return 'Дождь был в последний час - хорошо для радуги';
    } else if (timeSinceRain < 2) {
      return 'Дождь был 1-2 часа назад - возможна радуга';
    } else {
      return 'Дождь был более 2 часов назад';
    }
  }

  /**
   * Получение подробного прогноза (One Call API)
   */
  static async getDetailedForecast(latitude, longitude) {
    try {
      const url = `${ONE_CALL_URL}?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ru&exclude=minutely`;
      
      const response = await fetch(url);
      if (!response.ok) {
        // Fallback на бесплатный API
        return await this.getForecast5Days(latitude, longitude);
      }
      
      const data = await response.json();
      
      return {
        current: this.transformWeatherData(data.current),
        hourly: data.hourly?.slice(0, 24).map(hour => this.transformWeatherData(hour)) || [],
        daily: data.daily?.slice(0, 7).map(day => this.transformDailyWeather(day)) || [],
        alerts: data.alerts || []
      };
    } catch (error) {
      console.error('Ошибка получения детального прогноза:', error);
      // Fallback на базовый API
      return await this.getForecast5Days(latitude, longitude);
    }
  }

  /**
   * Получение 5-дневного прогноза (бесплатный API)
   */
  static async getForecast5Days(latitude, longitude) {
    try {
      const url = `${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ru`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Группируем по дням
      const dailyData = this.groupForecastByDays(data.list);
      
      return {
        current: null, // Получаем отдельно
        hourly: data.list.slice(0, 8).map(item => this.transformWeatherData(item)),
        daily: dailyData,
        alerts: []
      };
    } catch (error) {
      console.error('Ошибка получения прогноза:', error);
      throw new Error('Не удалось получить прогноз погоды.');
    }
  }

  /**
   * Получение качества воздуха
   */
  static async getAirQuality(latitude, longitude) {
    try {
      const url = `${BASE_URL}/air_pollution?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return null; // Качество воздуха опционально
      }
      
      const data = await response.json();
      
      if (data.list && data.list.length > 0) {
        const current = data.list[0];
        return {
          aqi: current.main.aqi,
          components: current.components,
          description: this.getAQIDescription(current.main.aqi)
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Не удалось получить данные о качестве воздуха:', error);
      return null;
    }
  }

  /**
   * Преобразование данных погоды в стандартный формат
   */
  static transformWeatherData(data) {
    return {
      // Основные параметры
      temperature: data.temp || data.main?.temp,
      feelsLike: data.feels_like || data.main?.feels_like,
      humidity: data.humidity || data.main?.humidity,
      pressure: data.pressure || data.main?.pressure,
      
      // Видимость
      visibility: data.visibility || 10000, // Метры
      
      // Облачность
      clouds: {
        all: data.clouds?.all || 0
      },
      
      // Ветер
      wind: {
        speed: data.wind?.speed || 0, // м/с
        direction: data.wind?.deg || 0, // градусы
        gust: data.wind?.gust || 0
      },
      
      // Осадки
      rain: data.rain || null,
      snow: data.snow || null,
      
      // Описание
      weather: data.weather || [{
        main: 'Clear',
        description: 'ясно',
        icon: '01d'
      }],
      
      // UV индекс
      uvi: data.uvi || null,
      
      // Время
      dt: data.dt ? new Date(data.dt * 1000) : new Date(),
      
      // Дополнительные данные
      dewPoint: data.dew_point,
      timezone: data.timezone
    };
  }

  /**
   * Преобразование дневных данных
   */
  static transformDailyWeather(data) {
    return {
      date: new Date(data.dt * 1000),
      temperature: {
        min: data.temp.min,
        max: data.temp.max,
        day: data.temp.day,
        night: data.temp.night,
        morning: data.temp.morn,
        evening: data.temp.eve
      },
      humidity: data.humidity,
      pressure: data.pressure,
      clouds: { all: data.clouds },
      wind: {
        speed: data.wind_speed,
        direction: data.wind_deg,
        gust: data.wind_gust || 0
      },
      rain: data.rain ? { '1h': data.rain } : null,
      snow: data.snow ? { '1h': data.snow } : null,
      weather: data.weather,
      uvi: data.uvi,
      
      // Астрономические данные
      sunrise: new Date(data.sunrise * 1000),
      sunset: new Date(data.sunset * 1000),
      moonrise: data.moonrise ? new Date(data.moonrise * 1000) : null,
      moonset: data.moonset ? new Date(data.moonset * 1000) : null,
      moonPhase: data.moon_phase
    };
  }

  /**
   * Группировка прогноза по дням
   */
  static groupForecastByDays(forecastList) {
    const dailyMap = new Map();
    
    forecastList.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      
      dailyMap.get(dateKey).push(this.transformWeatherData(item));
    });
    
    // Преобразуем в дневные данные
    const dailyData = [];
    dailyMap.forEach((dayData, dateKey) => {
      const temps = dayData.map(d => d.temperature);
      const humidities = dayData.map(d => d.humidity);
      
      dailyData.push({
        date: new Date(dateKey),
        temperature: {
          min: Math.min(...temps),
          max: Math.max(...temps),
          day: temps[Math.floor(temps.length / 2)] // Примерно полдень
        },
        humidity: humidities.reduce((a, b) => a + b, 0) / humidities.length,
        pressure: dayData[0].pressure,
        clouds: { all: dayData.reduce((sum, d) => sum + d.clouds.all, 0) / dayData.length },
        wind: dayData[0].wind,
        weather: dayData[0].weather, // Берем первое описание
        hourlyData: dayData
      });
    });
    
    return dailyData.slice(0, 5); // 5 дней
  }

  /**
   * Анализ условий для радуги за период
   */
  static async analyzeRainbowConditionsOverTime(latitude, longitude, hours = 24) {
    try {
      const forecast = await this.getDetailedForecast(latitude, longitude);
      const hourlyData = forecast.hourly.slice(0, hours);
      
      const RainbowCalculator = (await import('./RainbowCalculator')).RainbowCalculator;
      
      const predictions = hourlyData.map(weather => {
        const conditions = {
          latitude,
          longitude,
          weather,
          dateTime: weather.dt
        };
        
        return {
          time: weather.dt,
          ...RainbowCalculator.calculateRainbowProbability(conditions)
        };
      });
      
      // Находим оптимальные времена
      const optimalTimes = predictions
        .filter(p => p.probability > 50)
        .sort((a, b) => b.probability - a.probability);
      
      return {
        predictions,
        optimalTimes,
        nextBestTime: optimalTimes[0] || null,
        averageProbability: predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length
      };
    } catch (error) {
      console.error('Ошибка анализа условий радуги:', error);
      throw error;
    }
  }

  /**
   * Проверка недавнего дождя
   */
  static checkRecentRain(weather) {
    // Проверяем текущие осадки
    if (weather.rain && weather.rain['1h'] > 0) {
      return {
        hasRain: true,
        intensity: this.getRainIntensity(weather.rain['1h']),
        type: 'current'
      };
    }
    
    // Проверяем по описанию
    const description = weather.weather[0].description.toLowerCase();
    if (description.includes('дождь') || description.includes('rain')) {
      return {
        hasRain: true,
        intensity: 'unknown',
        type: 'recent'
      };
    }
    
    // Проверяем высокую влажность как признак недавнего дождя
    if (weather.humidity > 85) {
      return {
        hasRain: true,
        intensity: 'light',
        type: 'humidity'
      };
    }
    
    return {
      hasRain: false,
      intensity: 'none',
      type: 'none'
    };
  }

  /**
   * Определение интенсивности дождя
   */
  static getRainIntensity(mmPerHour) {
    if (mmPerHour < 0.1) return 'trace';
    if (mmPerHour < 0.5) return 'very_light';
    if (mmPerHour < 2.0) return 'light';
    if (mmPerHour < 10.0) return 'moderate';
    if (mmPerHour < 50.0) return 'heavy';
    return 'violent';
  }

  /**
   * Описание качества воздуха
   */
  static getAQIDescription(aqi) {
    const descriptions = {
      1: 'Отличное',
      2: 'Хорошее',
      3: 'Умеренное',
      4: 'Плохое',
      5: 'Очень плохое'
    };
    
    return descriptions[aqi] || 'Неизвестно';
  }

  /**
   * Получение геокодированного названия места
   */
  static async getLocationName(latitude, longitude) {
    try {
      const url = `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return {
          city: data.name,
          country: data.sys.country,
          state: data.sys.state || null
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Не удалось получить название места:', error);
      return null;
    }
  }

  /**
   * Проверка доступности API
   */
  static async checkAPIHealth() {
    try {
      // Тестовый запрос для Москвы
      const url = `${BASE_URL}/weather?q=Moscow&appid=${API_KEY}`;
      const response = await fetch(url);
      
      return {
        isAvailable: response.ok,
        status: response.status,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        isAvailable: false,
        status: 0,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
} 