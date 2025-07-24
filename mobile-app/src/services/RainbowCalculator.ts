/**
 * RainbowCalculator - Научно обоснованный расчет вероятности появления радуги
 * 
 * Основан на физических принципах формирования радуги:
 * 1. Угол солнца должен быть < 42° над горизонтом
 * 2. Наличие капель воды в атмосфере (после дождя, туман, мист)
 * 3. Прямой солнечный свет
 * 4. Радуга видна под углом 42° от антисолярной точки
 */

import { SunCalculator } from './SunCalculator';

export interface WeatherConditions {
  // Основные погодные параметры
  temperature: number;          // Температура в °C
  humidity: number;            // Влажность в %
  visibility: number;          // Видимость в км
  cloudiness: number;          // Облачность в %
  precipitation: number;       // Осадки в мм/ч
  weatherMain: string;         // Основное описание погоды
  weatherDescription: string;  // Детальное описание
  windSpeed: number;          // Скорость ветра в м/с
  pressure: number;           // Давление в гПа
  uvIndex?: number;           // УФ индекс
}

export interface RainbowInput {
  weather: WeatherConditions;
  sunAngle: number;           // Высота солнца в градусах
  sunAzimuth: number;         // Азимут солнца в градусах
  latitude: number;
  longitude: number;
  timestamp?: Date;
}

export interface RainbowResult {
  probability: number;        // Вероятность 0-100%
  factors: {
    sunAngleFactor: number;   // Фактор угла солнца
    waterDropletFactor: number; // Фактор наличия капель
    lightFactor: number;      // Фактор освещения
    visibilityFactor: number; // Фактор видимости
    timingFactor: number;     // Фактор времени суток
  };
  conditions: {
    optimalSunAngle: boolean;
    hasWaterDroplets: boolean;
    adequateLight: boolean;
    goodVisibility: boolean;
    optimalTiming: boolean;
  };
  rainbowDirection: number;   // Направление радуги в градусах
  quality: 'low' | 'medium' | 'high' | 'excellent';
}

export class RainbowCalculator {
  
  /**
   * Основная функция расчета вероятности радуги
   */
  static calculateRainbowProbability(input: RainbowInput): number {
    const result = this.calculateDetailedRainbowConditions(input);
    return result.probability;
  }

  /**
   * Детальный расчет условий для радуги
   */
  static calculateDetailedRainbowConditions(input: RainbowInput): RainbowResult {
    const { weather, sunAngle, sunAzimuth, latitude, longitude } = input;

    // 1. Фактор угла солнца (критический!)
    const sunAngleFactor = this.calculateSunAngleFactor(sunAngle);
    
    // 2. Фактор наличия капель воды в атмосфере
    const waterDropletFactor = this.calculateWaterDropletFactor(weather);
    
    // 3. Фактор освещения (прямой солнечный свет)
    const lightFactor = this.calculateLightFactor(weather, sunAngle);
    
    // 4. Фактор видимости
    const visibilityFactor = this.calculateVisibilityFactor(weather);
    
    // 5. Фактор времени суток
    const timingFactor = this.calculateTimingFactor(sunAngle, latitude, longitude);

    // Общая вероятность (все факторы должны быть благоприятными)
    const probability = Math.min(100, 
      sunAngleFactor * waterDropletFactor * lightFactor * visibilityFactor * timingFactor
    );

    // Направление радуги (42° от антисолярной точки)
    const rainbowDirection = (sunAzimuth + 180 + 42) % 360;

    // Качество радуги
    let quality: 'low' | 'medium' | 'high' | 'excellent' = 'low';
    if (probability >= 90) quality = 'excellent';
    else if (probability >= 70) quality = 'high';
    else if (probability >= 50) quality = 'medium';

    return {
      probability,
      factors: {
        sunAngleFactor,
        waterDropletFactor,
        lightFactor,
        visibilityFactor,
        timingFactor,
      },
      conditions: {
        optimalSunAngle: sunAngleFactor > 0.8,
        hasWaterDroplets: waterDropletFactor > 0.6,
        adequateLight: lightFactor > 0.7,
        goodVisibility: visibilityFactor > 0.8,
        optimalTiming: timingFactor > 0.8,
      },
      rainbowDirection,
      quality,
    };
  }

  /**
   * Расчет фактора угла солнца
   * Радуга видна только когда солнце < 42° над горизонтом
   */
  private static calculateSunAngleFactor(sunAngle: number): number {
    if (sunAngle < 0) return 0; // Солнце за горизонтом
    if (sunAngle > 42) return 0; // Слишком высоко
    
    // Оптимальный диапазон: 10-35°
    if (sunAngle >= 10 && sunAngle <= 35) {
      return 1.0;
    }
    
    // Постепенное снижение за пределами оптимального диапазона
    if (sunAngle < 10) {
      return Math.max(0, sunAngle / 10);
    }
    
    // sunAngle между 35 и 42
    return Math.max(0, (42 - sunAngle) / 7);
  }

  /**
   * Расчет фактора наличия капель воды
   */
  private static calculateWaterDropletFactor(weather: WeatherConditions): number {
    let factor = 0;

    // Высокая влажность способствует образованию капель
    const humidityFactor = Math.min(1, weather.humidity / 80);
    factor += humidityFactor * 0.3;

    // Недавние осадки оставляют капли в воздухе
    if (weather.precipitation > 0) {
      factor += 0.8; // Активные осадки
    } else if (weather.weatherMain.includes('Rain') || 
               weather.weatherDescription.includes('rain')) {
      factor += 0.6; // Недавний дождь
    }

    // Туман и мист содержат капли воды
    if (weather.weatherMain.includes('Mist') || 
        weather.weatherMain.includes('Fog') ||
        weather.weatherDescription.includes('mist') ||
        weather.weatherDescription.includes('fog')) {
      factor += 0.7;
    }

    // Грозы часто сопровождаются радугой
    if (weather.weatherMain.includes('Thunderstorm')) {
      factor += 0.5;
    }

    return Math.min(1, factor);
  }

  /**
   * Расчет фактора освещения
   */
  private static calculateLightFactor(weather: WeatherConditions, sunAngle: number): number {
    if (sunAngle <= 0) return 0; // Ночь

    // Облачность влияет на прямое освещение
    const cloudinessFactor = Math.max(0, (100 - weather.cloudiness) / 100);
    
    // Но небольшая облачность может быть полезна (создает капли)
    let adjustedCloudinessFactor = cloudinessFactor;
    if (weather.cloudiness >= 20 && weather.cloudiness <= 60) {
      adjustedCloudinessFactor = Math.min(1, cloudinessFactor + 0.2);
    }

    // Видимость влияет на освещение
    const visibilityInfluence = Math.min(1, weather.visibility / 10);

    return adjustedCloudinessFactor * 0.7 + visibilityInfluence * 0.3;
  }

  /**
   * Расчет фактора видимости
   */
  private static calculateVisibilityFactor(weather: WeatherConditions): number {
    // Хорошая видимость необходима для наблюдения радуги
    if (weather.visibility >= 10) return 1.0;
    if (weather.visibility >= 5) return 0.8;
    if (weather.visibility >= 2) return 0.5;
    return 0.2;
  }

  /**
   * Расчет фактора времени суток
   */
  private static calculateTimingFactor(sunAngle: number, latitude: number, longitude: number): number {
    const now = new Date();
    const sunTimes = SunCalculator.calculateSunTimes(latitude, longitude, now);
    
    const currentTime = now.getTime();
    const sunrise = sunTimes.sunrise.getTime();
    const sunset = sunTimes.sunset.getTime();
    
    // Лучшее время: 1-3 часа после восхода или за 1-3 часа до заката
    const morningOptimal = sunrise + (1 * 60 * 60 * 1000); // +1 час
    const morningEnd = sunrise + (3 * 60 * 60 * 1000); // +3 часа
    const eveningStart = sunset - (3 * 60 * 60 * 1000); // -3 часа
    const eveningOptimal = sunset - (1 * 60 * 60 * 1000); // -1 час
    
    if ((currentTime >= morningOptimal && currentTime <= morningEnd) ||
        (currentTime >= eveningStart && currentTime <= eveningOptimal)) {
      return 1.0;
    }
    
    // Приемлемое время: первый час после восхода или последний час до заката
    if ((currentTime >= sunrise && currentTime < morningOptimal) ||
        (currentTime > eveningOptimal && currentTime <= sunset)) {
      return 0.7;
    }
    
    // Плохое время (полуденное солнце)
    return 0.3;
  }

  /**
   * Определение следующего оптимального времени для радуги
   */
  static getNextOptimalTime(latitude: number, longitude: number): Date | null {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Проверяем завтрашний день
    const sunTimes = SunCalculator.calculateSunTimes(latitude, longitude, tomorrow);
    
    // Утреннее оптимальное время (1-2 часа после восхода)
    const morningOptimal = new Date(sunTimes.sunrise);
    morningOptimal.setHours(morningOptimal.getHours() + 1);
    
    // Вечернее оптимальное время (2-1 час до заката)
    const eveningOptimal = new Date(sunTimes.sunset);
    eveningOptimal.setHours(eveningOptimal.getHours() - 2);
    
    // Возвращаем ближайшее время
    const nowTime = now.getTime();
    const morningTime = morningOptimal.getTime();
    const eveningTime = eveningOptimal.getTime();
    
    if (morningTime > nowTime) {
      return morningOptimal;
    } else if (eveningTime > nowTime) {
      return eveningOptimal;
    }
    
    return morningOptimal; // Завтрашнее утро
  }

  /**
   * Проверка, являются ли текущие условия оптимальными
   */
  static areConditionsOptimal(input: RainbowInput): boolean {
    const result = this.calculateDetailedRainbowConditions(input);
    return result.probability >= 70;
  }

  /**
   * Получение рекомендаций для улучшения условий
   */
  static getRecommendations(input: RainbowInput): string[] {
    const result = this.calculateDetailedRainbowConditions(input);
    const recommendations: string[] = [];

    if (!result.conditions.optimalSunAngle) {
      if (input.sunAngle > 42) {
        recommendations.push('Дождитесь, когда солнце опустится ниже 42° над горизонтом');
      } else if (input.sunAngle < 0) {
        recommendations.push('Дождитесь восхода солнца');
      } else {
        recommendations.push('Оптимальный угол солнца: 10-35° над горизонтом');
      }
    }

    if (!result.conditions.hasWaterDroplets) {
      recommendations.push('Дождитесь дождя или найдите место с туманом/мистом');
    }

    if (!result.conditions.adequateLight) {
      recommendations.push('Нужно больше прямого солнечного света');
    }

    if (!result.conditions.goodVisibility) {
      recommendations.push('Дождитесь улучшения видимости');
    }

    if (!result.conditions.optimalTiming) {
      recommendations.push('Лучшее время: утром через 1-3 часа после восхода или вечером за 1-3 часа до заката');
    }

    return recommendations;
  }
} 