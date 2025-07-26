/**
 * Сервис для работы с OpenWeatherMap API
 * Получение актуальных погодных данных и прогнозов
 */

const API_KEY = 'be314fc63d2ce6bc8c976a4e60be8955';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';

export class WeatherService {
  /**
   * Получение текущей погоды
   */
  static async getCurrentWeather(latitude, longitude) {
    try {
      const url = `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ru`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return this.transformWeatherData(data);
    } catch (error) {
      console.error('Ошибка получения погодных данных:', error);
      throw new Error('Не удалось получить данные о погоде. Проверьте соединение с интернетом.');
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