/**
 * Научный калькулятор вероятности радуги
 * Основан на физических законах оптики и метеорологии
 */

import { SunCalculator } from './SunCalculator';

export class RainbowCalculator {
  // Физические константы
  static RAINBOW_ANGLE_PRIMARY = 42.0; // Угол первичной радуги (угол Декарта)
  static RAINBOW_ANGLE_SECONDARY = 51.0; // Угол вторичной радуги
  static CRITICAL_SUN_ANGLE = 42.0; // Максимальный угол солнца для радуги
  static OPTIMAL_SUN_ANGLES = [15, 25]; // Оптимальные углы солнца
  static RAINBOW_WIDTH = 2.0; // Ширина радуги в градусах
  
  // Метеорологические константы
  static MIN_HUMIDITY = 60; // Минимальная влажность для радуги
  static OPTIMAL_HUMIDITY = [75, 90]; // Оптимальная влажность
  static MIN_VISIBILITY = 5000; // Минимальная видимость в метрах
  static OPTIMAL_VISIBILITY = 10000; // Оптимальная видимость
  static MAX_WIND_SPEED = 10; // Максимальная скорость ветра (м/с)

  /**
   * Основной расчет вероятности радуги
   */
  static calculateRainbowProbability(conditions) {
    const { latitude, longitude, weather, dateTime = new Date() } = conditions;
    
    // 1. Астрономические расчеты
    const sunPosition = SunCalculator.calculateSunPosition(latitude, longitude, dateTime);
    const solarEvents = SunCalculator.calculateSolarEvents(latitude, longitude, dateTime);
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА: Если солнце под горизонтом, радуга НЕВОЗМОЖНА
    if (sunPosition.altitude <= 0) {
      return {
        probability: 0,
        direction: null,
        quality: 'none',
        sunPosition: sunPosition,
        factors: { reason: 'Солнце под горизонтом' },
        conditions: [{ type: 'critical', message: 'Солнце под горизонтом - радуга невозможна' }],
        recommendations: ['Дождитесь восхода солнца', 'Радуга возможна только днем']
      };
    }
    
    // 2. Основные факторы
    const sunAngleFactor = this.calculateSunAngleFactor(sunPosition.altitude);
    const timeFactors = this.calculateTimeFactors(dateTime, solarEvents);
    const weatherFactors = this.calculateWeatherFactors(weather);
    const atmosphericFactors = this.calculateAtmosphericFactors(weather, latitude);
    const geometricFactors = this.calculateGeometricFactors(sunPosition, weather);
    
    // 3. Составной расчет вероятности
    const baseProbability = this.calculateBaseProbability(
      sunAngleFactor, 
      weatherFactors, 
      atmosphericFactors
    );
    
    const timeModifier = timeFactors.timeOfDayFactor * timeFactors.seasonalFactor;
    const environmentModifier = geometricFactors.lightScatteringFactor * 
                               geometricFactors.dropletDistributionFactor;
    
    // 4. Финальный расчет с учетом всех факторов
    let finalProbability = baseProbability * timeModifier * environmentModifier;
    
    // 5. Бонусы и штрафы
    finalProbability = this.applyBonusesAndPenalties(
      finalProbability, 
      weather, 
      sunPosition, 
      timeFactors
    );
    
    // 6. Нормализация (0-100%)
    finalProbability = Math.max(0, Math.min(100, finalProbability));
    
    // 7. Направление радуги
    const rainbowDirection = this.calculateRainbowDirection(sunPosition);
    
    // 8. Качество радуги
    const rainbowQuality = this.calculateRainbowQuality(
      finalProbability, 
      sunPosition, 
      weather
    );
    
    return {
      probability: Math.round(finalProbability * 10) / 10,
      direction: rainbowDirection,
      quality: rainbowQuality,
      sunPosition: sunPosition,
      factors: {
        sunAngle: sunAngleFactor,
        weather: weatherFactors,
        atmospheric: atmosphericFactors,
        timing: timeFactors,
        geometric: geometricFactors
      },
      conditions: this.analyzeConditions(sunPosition, weather, timeFactors),
      recommendations: this.generateRecommendations(
        finalProbability, 
        sunPosition, 
        weather, 
        solarEvents
      )
    };
  }

  /**
   * Расчет фактора угла солнца
   */
  static calculateSunAngleFactor(sunAltitude) {
    // КРИТИЧЕСКАЯ ПРОВЕРКА: Солнце должно быть над горизонтом
    if (sunAltitude <= 0) {
      return 0; // Солнце под горизонтом или на горизонте - радуга НЕВОЗМОЖНА
    }
    
    // Минимальный угол для радуги (солнце должно быть достаточно высоко)
    if (sunAltitude < 5) {
      return 0; // Слишком низко, атмосферная рефракция мешает
    }
    
    if (sunAltitude > this.CRITICAL_SUN_ANGLE) {
      return 0; // Солнце слишком высоко
    }
    
    // Оптимальные углы: 15-25 градусов
    if (sunAltitude >= this.OPTIMAL_SUN_ANGLES[0] && 
        sunAltitude <= this.OPTIMAL_SUN_ANGLES[1]) {
      return 1.0; // Идеальный угол
    }
    
    // Градация вероятности
    if (sunAltitude < this.OPTIMAL_SUN_ANGLES[0]) {
      // Чем ниже солнце, тем сложнее увидеть радугу
      return 0.3 + 0.7 * (sunAltitude / this.OPTIMAL_SUN_ANGLES[0]);
    } else {
      // Линейное снижение от 25° до 42°
      const range = this.CRITICAL_SUN_ANGLE - this.OPTIMAL_SUN_ANGLES[1];
      const position = sunAltitude - this.OPTIMAL_SUN_ANGLES[1];
      return 1.0 - 0.8 * (position / range);
    }
  }

  /**
   * Расчет временных факторов
   */
  static calculateTimeFactors(dateTime, solarEvents) {
    const hour = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    const timeDecimal = hour + minutes / 60;
    
    // 1. Фактор времени суток
    let timeOfDayFactor = 0.1; // Базовое значение
    
    // Оптимальное время: раннее утро (6-10) и поздний день (16-20)
    if ((timeDecimal >= 6 && timeDecimal <= 10) || 
        (timeDecimal >= 16 && timeDecimal <= 20)) {
      timeOfDayFactor = 1.0;
    } else if ((timeDecimal >= 10 && timeDecimal <= 12) || 
               (timeDecimal >= 14 && timeDecimal <= 16)) {
      timeOfDayFactor = 0.6; // Менее оптимальное время
    } else if ((timeDecimal >= 5 && timeDecimal < 6) || 
               (timeDecimal > 20 && timeDecimal <= 21)) {
      timeOfDayFactor = 0.4; // Сумеречное время
    }
    
    // 2. Сезонный фактор
    const month = dateTime.getMonth() + 1;
    let seasonalFactor = 0.8; // Базовое значение
    
    // Весна-лето: больше дождей и солнца
    if (month >= 4 && month <= 9) {
      seasonalFactor = 1.0;
    } else if (month >= 3 && month <= 4 || month >= 9 && month <= 10) {
      seasonalFactor = 0.9; // Переходные сезоны
    }
    
    return {
      timeOfDayFactor: timeOfDayFactor,
      seasonalFactor: seasonalFactor,
      currentHour: hour,
      solarEvents: solarEvents
    };
  }

  /**
   * Расчет погодных факторов
   */
  static calculateWeatherFactors(weather) {
    const factors = {
      rainFactor: 0,
      humidityFactor: 0,
      cloudFactor: 0,
      visibilityFactor: 0,
      windFactor: 0,
      temperatureFactor: 0
    };
    
    // 1. Фактор дождя/осадков
    const precipitation = weather.rain ? weather.rain['1h'] || 0 : 0;
    const description = weather.weather[0].description.toLowerCase();
    
    if (description.includes('дождь') || description.includes('rain')) {
      if (description.includes('легкий') || description.includes('light')) {
        factors.rainFactor = 1.0; // Легкий дождь - идеально
      } else if (description.includes('умеренный') || description.includes('moderate')) {
        factors.rainFactor = 0.8;
      } else {
        factors.rainFactor = 0.4; // Сильный дождь
      }
    } else if (description.includes('туман') || description.includes('mist')) {
      factors.rainFactor = 0.6; // Туман может создать радугу
    } else if (weather.main.humidity > 80) {
      factors.rainFactor = 0.3; // Высокая влажность
    }
    
    // 2. Фактор влажности
    const humidity = weather.main.humidity;
    if (humidity >= this.OPTIMAL_HUMIDITY[0] && humidity <= this.OPTIMAL_HUMIDITY[1]) {
      factors.humidityFactor = 1.0;
    } else if (humidity >= this.MIN_HUMIDITY) {
      factors.humidityFactor = 0.5 + 0.5 * 
        (humidity - this.MIN_HUMIDITY) / (this.OPTIMAL_HUMIDITY[0] - this.MIN_HUMIDITY);
    }
    
    // 3. Фактор облачности
    const clouds = weather.clouds.all;
    if (clouds >= 20 && clouds <= 70) {
      factors.cloudFactor = 1.0; // Переменная облачность - идеально
    } else if (clouds < 20) {
      factors.cloudFactor = 0.3; // Слишком ясно
    } else if (clouds <= 85) {
      factors.cloudFactor = 0.6; // Пасмурно, но возможно
    } else {
      factors.cloudFactor = 0.1; // Очень пасмурно
    }
    
    // 4. Фактор видимости
    const visibility = weather.visibility || 10000;
    if (visibility >= this.OPTIMAL_VISIBILITY) {
      factors.visibilityFactor = 1.0;
    } else if (visibility >= this.MIN_VISIBILITY) {
      factors.visibilityFactor = visibility / this.OPTIMAL_VISIBILITY;
    } else {
      factors.visibilityFactor = 0.2;
    }
    
    // 5. Фактор ветра
    const windSpeed = weather.wind ? weather.wind.speed : 0;
    if (windSpeed <= 3) {
      factors.windFactor = 1.0; // Слабый ветер - идеально
    } else if (windSpeed <= this.MAX_WIND_SPEED) {
      factors.windFactor = 1.0 - 0.6 * (windSpeed - 3) / (this.MAX_WIND_SPEED - 3);
    } else {
      factors.windFactor = 0.2; // Сильный ветер разгоняет капли
    }
    
    // 6. Фактор температуры
    const temperature = weather.main.temp;
    if (temperature >= 10 && temperature <= 25) {
      factors.temperatureFactor = 1.0; // Комфортная температура
    } else if (temperature >= 0 && temperature < 10) {
      factors.temperatureFactor = 0.7; // Прохладно
    } else if (temperature > 25 && temperature <= 35) {
      factors.temperatureFactor = 0.8; // Тепло
    } else {
      factors.temperatureFactor = 0.5; // Экстремальные температуры
    }
    
    return factors;
  }

  /**
   * Расчет атмосферных факторов
   */
  static calculateAtmosphericFactors(weather, latitude) {
    // 1. Фактор рассеяния света
    const uvIndex = weather.uvi || this.estimateUVIndex(weather, latitude);
    const lightScatteringFactor = Math.min(1.0, uvIndex / 5.0);
    
    // 2. Фактор давления
    const pressure = weather.main.pressure;
    let pressureFactor = 1.0;
    if (pressure < 1000 || pressure > 1020) {
      pressureFactor = 0.8; // Нестабильное давление
    }
    
    // 3. Фактор загрязнения воздуха
    let airQualityFactor = 0.9; // По умолчанию хорошее качество
    // Здесь можно добавить API качества воздуха
    
    return {
      lightScatteringFactor: lightScatteringFactor,
      pressureFactor: pressureFactor,
      airQualityFactor: airQualityFactor
    };
  }

  /**
   * Расчет геометрических факторов
   */
  static calculateGeometricFactors(sunPosition, weather) {
    // 1. Фактор рассеяния света в атмосфере
    const zenithAngle = 90 - sunPosition.altitude;
    const airmass = 1 / Math.cos(zenithAngle * Math.PI / 180);
    const lightScatteringFactor = Math.max(0.3, 1.0 - (airmass - 1) * 0.1);
    
    // 2. Фактор распределения капель
    const humidity = weather.main.humidity;
    const temperature = weather.main.temp;
    
    // Оптимальное распределение капель при определенных условиях
    let dropletDistributionFactor = 0.5;
    if (humidity > 70 && temperature > 5 && temperature < 30) {
      dropletDistributionFactor = 0.8 + 0.2 * (humidity - 70) / 30;
    }
    
    return {
      lightScatteringFactor: lightScatteringFactor,
      dropletDistributionFactor: dropletDistributionFactor,
      airmass: airmass
    };
  }

  /**
   * Расчет базовой вероятности
   */
  static calculateBaseProbability(sunAngleFactor, weatherFactors, atmosphericFactors) {
    // Взвешенная сумма основных факторов
    const weightedSum = 
      sunAngleFactor * 0.3 + // 30% - угол солнца (критично)
      weatherFactors.rainFactor * 0.25 + // 25% - наличие капель воды
      weatherFactors.cloudFactor * 0.15 + // 15% - облачность
      weatherFactors.visibilityFactor * 0.1 + // 10% - видимость
      weatherFactors.humidityFactor * 0.1 + // 10% - влажность
      atmosphericFactors.lightScatteringFactor * 0.1; // 10% - рассеяние света
    
    return weightedSum * 100; // Преобразуем в проценты
  }

  /**
   * Применение бонусов и штрафов
   */
  static applyBonusesAndPenalties(probability, weather, sunPosition, timeFactors) {
    let modifiedProbability = probability;
    
    // КРИТИЧЕСКИЕ ШТРАФЫ (полное обнуление)
    if (sunPosition.altitude <= 0) {
      return 0; // Солнце под горизонтом - радуга АБСОЛЮТНО невозможна
    }
    
    if (sunPosition.altitude < 5) {
      return 0; // Солнце слишком низко - радуга невозможна
    }
    
    // Проверка времени суток (дополнительная защита от ночных расчетов)
    const hour = timeFactors.currentHour;
    if (hour >= 22 || hour <= 4) {
      return 0; // Ночное время - радуга невозможна
    }
    
    // Бонусы
    if (weather.weather[0].description.includes('дождь') && 
        sunPosition.altitude > 5 && sunPosition.altitude < 30) {
      modifiedProbability *= 1.2; // Бонус за дождь при низком солнце
    }
    
    if (timeFactors.currentHour >= 17 && timeFactors.currentHour <= 19) {
      modifiedProbability *= 1.1; // Бонус за "золотой час"
    }
    
    // Обычные штрафы
    
    if (weather.main.humidity < 50) {
      modifiedProbability *= 0.5; // Штраф за низкую влажность
    }
    
    if (weather.clouds.all > 90) {
      modifiedProbability *= 0.3; // Штраф за сплошную облачность
    }
    
    return modifiedProbability;
  }

  /**
   * Расчет направления радуги
   */
  static calculateRainbowDirection(sunPosition) {
    // Радуга всегда появляется в направлении противоположном солнцу
    // под углом 42° от антисолярной точки
    const antiSolarAzimuth = (sunPosition.azimuth + 180) % 360;
    
    return {
      center: antiSolarAzimuth,
      range: {
        start: (antiSolarAzimuth - this.RAINBOW_WIDTH / 2 + 360) % 360,
        end: (antiSolarAzimuth + this.RAINBOW_WIDTH / 2) % 360
      },
      elevation: this.RAINBOW_ANGLE_PRIMARY - sunPosition.altitude,
      type: 'primary' // Первичная радуга
    };
  }

  /**
   * Расчет качества радуги
   */
  static calculateRainbowQuality(probability, sunPosition, weather) {
    if (probability < 20) return 'none';
    if (probability < 40) return 'very_weak';
    if (probability < 60) return 'weak';
    if (probability < 75) return 'moderate';
    if (probability < 90) return 'good';
    return 'excellent';
  }

  /**
   * Анализ текущих условий
   */
  static analyzeConditions(sunPosition, weather, timeFactors) {
    const conditions = [];
    
    // Анализ угла солнца
    if (sunPosition.altitude < 0) {
      conditions.push({ type: 'critical', message: 'Солнце под горизонтом' });
    } else if (sunPosition.altitude > this.CRITICAL_SUN_ANGLE) {
      conditions.push({ type: 'critical', message: 'Солнце слишком высоко для радуги' });
    } else if (sunPosition.altitude >= this.OPTIMAL_SUN_ANGLES[0] && 
               sunPosition.altitude <= this.OPTIMAL_SUN_ANGLES[1]) {
      conditions.push({ type: 'positive', message: 'Идеальный угол солнца' });
    }
    
    // Анализ погоды
    if (weather.weather[0].description.includes('дождь')) {
      conditions.push({ type: 'positive', message: 'Присутствуют осадки' });
    }
    
    if (weather.main.humidity > 80) {
      conditions.push({ type: 'positive', message: 'Высокая влажность' });
    }
    
    if (weather.clouds.all > 20 && weather.clouds.all < 70) {
      conditions.push({ type: 'positive', message: 'Переменная облачность' });
    }
    
    // Анализ времени
    if (timeFactors.timeOfDayFactor === 1.0) {
      conditions.push({ type: 'positive', message: 'Оптимальное время суток' });
    }
    
    return conditions;
  }

  /**
   * Генерация рекомендаций
   */
  static generateRecommendations(probability, sunPosition, weather, solarEvents) {
    const recommendations = [];
    
    if (probability > 60) {
      recommendations.push('Отличные условия для поиска радуги!');
      recommendations.push(`Смотрите в направлении ${Math.round((sunPosition.azimuth + 180) % 360)}°`);
    } else if (probability > 30) {
      recommendations.push('Возможны слабые радужные эффекты');
    } else {
      recommendations.push('Условия для радуги неблагоприятны');
    }
    
    // Рекомендации по времени
    if (sunPosition.altitude > this.CRITICAL_SUN_ANGLE) {
      const sunset = solarEvents.sunset;
      if (sunset) {
        recommendations.push(`Попробуйте после ${sunset.getHours()}:${sunset.getMinutes().toString().padStart(2, '0')}`);
      }
    }
    
    return recommendations;
  }

  /**
   * Оценка UV индекса (приблизительная)
   */
  static estimateUVIndex(weather, latitude) {
    const cloudiness = weather.clouds.all;
    const baseUV = Math.max(0, 10 - Math.abs(latitude) / 9);
    return baseUV * (1 - cloudiness / 100);
  }
} 