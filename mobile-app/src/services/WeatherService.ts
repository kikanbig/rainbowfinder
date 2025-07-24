/**
 * WeatherService - Сервис для работы с OpenWeatherMap API
 * 
 * Получает актуальные данные о погоде для анализа условий радуги:
 * - Текущая погода
 * - Прогноз погоды  
 * - Погодные условия (дождь, облачность, видимость)
 * - УФ индекс
 */

import { WeatherConditions } from './RainbowCalculator';

// Конфигурация API
const OPENWEATHER_API_KEY = 'be314fc63d2ce6bc8c976a4e60be8955';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';

export interface OpenWeatherResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  name: string;
}

export interface ForecastResponse {
  lat: number;
  lon: number;
  timezone: string;
  current: {
    dt: number;
    sunrise: number;
    sunset: number;
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    uvi: number;
    clouds: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    rain?: {
      '1h': number;
    };
  };
  hourly: Array<{
    dt: number;
    temp: number;
    pressure: number;
    humidity: number;
    clouds: number;
    visibility: number;
    wind_speed: number;
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    pop: number; // Probability of precipitation
    rain?: {
      '1h': number;
    };
  }>;
}

export interface RainbowForecast {
  timestamp: Date;
  probability: number;
  conditions: {
    sunAngle: number;
    weather: WeatherConditions;
    isOptimal: boolean;
  };
}

export class WeatherService {
  
  /**
   * Получение текущих погодных условий
   */
  static async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherConditions> {
    try {
      const url = `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=ru`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const data: OpenWeatherResponse = await response.json();
      
      return this.transformToWeatherConditions(data);
    } catch (error) {
      console.error('Ошибка получения погодных данных:', error);
      throw new Error('Не удалось получить данные о погоде. Проверьте соединение с интернетом.');
    }
  }
  
  /**
   * Получение расширенного прогноза погоды с УФ индексом
   */
  static async getDetailedForecast(latitude: number, longitude: number): Promise<ForecastResponse> {
    try {
      const url = `${ONE_CALL_URL}?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=ru`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка получения расширенного прогноза:', error);
      throw new Error('Не удалось получить расширенный прогноз погоды.');
    }
  }
  
  /**
   * Получение прогноза вероятности радуги на ближайшие часы
   */
  static async getRainbowForecast(latitude: number, longitude: number, hours: number = 24): Promise<RainbowForecast[]> {
    try {
      const forecast = await this.getDetailedForecast(latitude, longitude);
      const rainbowForecasts: RainbowForecast[] = [];
      
      // Импортируем нужные классы динамически для избежания циклических зависимостей
      const { RainbowCalculator } = await import('./RainbowCalculator');
      const { SunCalculator } = await import('./SunCalculator');
      
      // Анализируем каждый час в прогнозе
      for (let i = 0; i < Math.min(hours, forecast.hourly.length); i++) {
        const hourlyData = forecast.hourly[i];
        const timestamp = new Date(hourlyData.dt * 1000);
        
        // Рассчитываем положение солнца для этого времени
        const sunPosition = SunCalculator.calculateSunPosition(latitude, longitude, timestamp);
        
        // Преобразуем погодные данные
        const weather: WeatherConditions = {
          temperature: hourlyData.temp,
          humidity: hourlyData.humidity,
          visibility: hourlyData.visibility / 1000, // Преобразуем м в км
          cloudiness: hourlyData.clouds,
          precipitation: hourlyData.rain?.['1h'] || 0,
          weatherMain: hourlyData.weather[0].main,
          weatherDescription: hourlyData.weather[0].description,
          windSpeed: hourlyData.wind_speed,
          pressure: hourlyData.pressure,
        };
        
        // Рассчитываем вероятность радуги
        const probability = RainbowCalculator.calculateRainbowProbability({
          weather,
          sunAngle: sunPosition.altitude,
          sunAzimuth: sunPosition.azimuth,
          latitude,
          longitude,
          timestamp,
        });
        
        rainbowForecasts.push({
          timestamp,
          probability,
          conditions: {
            sunAngle: sunPosition.altitude,
            weather,
            isOptimal: probability > 60,
          },
        });
      }
      
      return rainbowForecasts;
    } catch (error) {
      console.error('Ошибка получения прогноза радуги:', error);
      throw new Error('Не удалось получить прогноз условий для радуги.');
    }
  }
  
  /**
   * Проверка, были ли недавние осадки (важно для радуги)
   */
  static async hasRecentRain(latitude: number, longitude: number, hoursBack: number = 6): Promise<boolean> {
    try {
      const forecast = await this.getDetailedForecast(latitude, longitude);
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
      
      // Проверяем текущие условия
      if (forecast.current.rain && forecast.current.rain['1h'] > 0) {
        return true;
      }
      
      // Проверяем почасовой прогноз назад (если доступен)
      for (const hourlyData of forecast.hourly) {
        const timestamp = new Date(hourlyData.dt * 1000);
        if (timestamp < cutoffTime) continue;
        if (timestamp > now) break;
        
        if (hourlyData.rain && hourlyData.rain['1h'] > 0) {
          return true;
        }
        
        // Также проверяем погодные условия
        if (hourlyData.weather.some(w => 
          w.main.includes('Rain') || 
          w.main.includes('Drizzle') ||
          w.main.includes('Thunderstorm')
        )) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Ошибка проверки недавних осадков:', error);
      return false;
    }
  }
  
  /**
   * Получение следующего времени с оптимальными условиями для радуги
   */
  static async getNextOptimalConditions(latitude: number, longitude: number): Promise<Date | null> {
    try {
      const rainbowForecasts = await this.getRainbowForecast(latitude, longitude, 48);
      
      // Ищем первое время с высокой вероятностью радуги
      for (const forecast of rainbowForecasts) {
        if (forecast.conditions.isOptimal) {
          return forecast.timestamp;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка поиска оптимальных условий:', error);
      return null;
    }
  }
  
  /**
   * Преобразование ответа OpenWeather в наш формат
   */
  private static transformToWeatherConditions(data: OpenWeatherResponse): WeatherConditions {
    const precipitation = (data.rain?.['1h'] || 0) + (data.snow?.['1h'] || 0);
    
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      visibility: data.visibility / 1000, // Преобразуем метры в километры
      cloudiness: data.clouds.all,
      precipitation,
      weatherMain: data.weather[0].main,
      weatherDescription: data.weather[0].description,
      windSpeed: data.wind.speed,
      pressure: data.main.pressure,
    };
  }
  
  /**
   * Получение описания погодных условий для радуги
   */
  static getWeatherSuitabilityDescription(weather: WeatherConditions): {
    suitability: 'excellent' | 'good' | 'fair' | 'poor';
    description: string;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let suitability: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    let description = '';
    
    // Анализ осадков
    const hasRain = weather.precipitation > 0 || 
                   weather.weatherMain.includes('Rain') ||
                   weather.weatherMain.includes('Drizzle');
    
    const hasClouds = weather.cloudiness > 20 && weather.cloudiness < 80;
    const goodVisibility = weather.visibility > 5;
    const hasWaterDroplets = hasRain || weather.humidity > 70 ||
                            weather.weatherMain.includes('Mist') ||
                            weather.weatherMain.includes('Fog');
    
    // Определяем пригодность
    if (hasWaterDroplets && hasClouds && goodVisibility) {
      suitability = 'excellent';
      description = 'Отличные условия для радуги!';
    } else if (hasWaterDroplets && goodVisibility) {
      suitability = 'good';
      description = 'Хорошие условия для радуги';
    } else if (hasWaterDroplets || (hasClouds && goodVisibility)) {
      suitability = 'fair';
      description = 'Средние условия для радуги';
    } else {
      suitability = 'poor';
      description = 'Неподходящие условия для радуги';
    }
    
    // Рекомендации
    if (!hasWaterDroplets) {
      recommendations.push('Дождитесь дождя или тумана');
    }
    
    if (!goodVisibility) {
      recommendations.push('Дождитесь улучшения видимости');
    }
    
    if (weather.cloudiness > 90) {
      recommendations.push('Дождитесь частичного прояснения');
    } else if (weather.cloudiness < 10) {
      recommendations.push('Небольшая облачность поможет создать капли воды');
    }
    
    if (weather.windSpeed > 10) {
      recommendations.push('Сильный ветер может рассеять капли воды');
    }
    
    return {
      suitability,
      description,
      recommendations,
    };
  }
  
  /**
   * Проверка валидности API ключа
   */
  static async validateApiKey(): Promise<boolean> {
    try {
      const url = `${BASE_URL}/weather?lat=0&lon=0&appid=${OPENWEATHER_API_KEY}`;
      const response = await fetch(url);
      return response.status !== 401;
    } catch {
      return false;
    }
  }
  
  /**
   * Получение информации о качестве воздуха (может влиять на видимость радуги)
   */
  static async getAirQuality(latitude: number, longitude: number): Promise<{
    aqi: number;
    visibility_impact: 'low' | 'medium' | 'high';
  } | null> {
    try {
      const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      const aqi = data.list[0].main.aqi;
      
      let visibility_impact: 'low' | 'medium' | 'high' = 'low';
      if (aqi >= 4) visibility_impact = 'high';
      else if (aqi >= 3) visibility_impact = 'medium';
      
      return { aqi, visibility_impact };
    } catch (error) {
      console.error('Ошибка получения данных о качестве воздуха:', error);
      return null;
    }
  }
} 