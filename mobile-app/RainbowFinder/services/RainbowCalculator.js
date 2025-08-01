/**
 * Научный калькулятор вероятности радуги
 * Основан на физических законах оптики и метеорологии
 */

import { SunCalculator } from './SunCalculator';
import Logger from '../utils/Logger';

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
   * Основной расчет вероятности радуги (С ЗАЩИТОЙ ОТ ОШИБОК)
   */
  static calculateRainbowProbability(conditions) {
    Logger.info('RAINBOW', '=== НАЧИНАЕМ РАСЧЕТ ВЕРОЯТНОСТИ РАДУГИ ===');
    
    try {
      if (!conditions || typeof conditions !== 'object') {
        Logger.error('RAINBOW', 'Отсутствуют или некорректные условия для расчета');
        throw new Error('Отсутствуют условия для расчета');
      }

      const { latitude, longitude, weather, dateTime = new Date() } = conditions;
      
      Logger.debug('RAINBOW', 'Входные данные', { latitude, longitude, dateTime });
      Logger.debug('RAINBOW', 'Погодные данные', weather);
      
      // Проверка входных данных
      if (!latitude || !longitude || !weather) {
        Logger.error('RAINBOW', 'Недостаточно данных для расчета');
        throw new Error('Недостаточно данных для расчета');
      }

      // Проверка корректности координат
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        Logger.error('RAINBOW', 'Некорректные координаты', { latitude, longitude });
        throw new Error('Некорректные координаты');
      }

      // Проверка структуры погодных данных
      if (!weather.main || !weather.weather || !Array.isArray(weather.weather) || weather.weather.length === 0) {
        Logger.error('RAINBOW', 'Некорректная структура погодных данных', weather);
        throw new Error('Некорректные погодные данные');
      }
      
      // 1. Астрономические расчеты
      let sunPosition, solarEvents;
      try {
        sunPosition = SunCalculator.calculateSunPosition(latitude, longitude, dateTime);
        solarEvents = SunCalculator.calculateSolarEvents(latitude, longitude, dateTime);
        
        // Проверка корректности результатов
        if (!sunPosition || typeof sunPosition.altitude !== 'number' || typeof sunPosition.azimuth !== 'number') {
          Logger.error('RAINBOW', 'Некорректные результаты расчета солнца', sunPosition);
          throw new Error('Ошибка в расчете положения солнца');
        }
      } catch (sunError) {
        Logger.error('RAINBOW', 'Ошибка астрономических расчетов', sunError);
        throw new Error('Ошибка в астрономических расчетах');
      }
      
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
      
      // 2. Основные факторы с защитой от ошибок
      let sunAngleFactor, timeFactors, weatherFactors, atmosphericFactors, geometricFactors;
      
      try {
        sunAngleFactor = this.calculateSunAngleFactor(sunPosition.altitude);
        timeFactors = this.calculateTimeFactors(dateTime, solarEvents);
        weatherFactors = this.calculateWeatherFactors(weather);
        atmosphericFactors = this.calculateAtmosphericFactors(weather, latitude);
        geometricFactors = this.calculateGeometricFactors(sunPosition, weather);
        
        // Проверка на NaN и бесконечность
        if (!this.validateFactors({ sunAngleFactor, timeFactors, weatherFactors, atmosphericFactors, geometricFactors })) {
          throw new Error('Некорректные результаты расчета факторов');
        }
      } catch (factorError) {
        Logger.error('RAINBOW', 'Ошибка расчета факторов', factorError);
        throw new Error('Ошибка в расчете факторов радуги');
      }
      
      // 3. Составной расчет вероятности
      let baseProbability, timeModifier, environmentModifier, finalProbability;
      
      try {
        baseProbability = this.calculateBaseProbability(
          sunAngleFactor, 
          weatherFactors, 
          atmosphericFactors
        );
        
        if (!this.isValidNumber(baseProbability)) {
          throw new Error('Некорректная базовая вероятность');
        }
        
        timeModifier = timeFactors.timeOfDayFactor * timeFactors.seasonalFactor;
        environmentModifier = geometricFactors.lightScatteringFactor * 
                               geometricFactors.dropletDistributionFactor;
        
        if (!this.isValidNumber(timeModifier) || !this.isValidNumber(environmentModifier)) {
          throw new Error('Некорректные модификаторы');
        }
        
        // 4. Финальный расчет с учетом всех факторов
        finalProbability = baseProbability * timeModifier * environmentModifier;
        
        // 5. Бонусы и штрафы
        finalProbability = this.applyBonusesAndPenalties(
          finalProbability, 
          weather, 
          sunPosition, 
          timeFactors
        );
        
        // 6. Нормализация (0-100%)
        finalProbability = Math.max(0, Math.min(100, finalProbability || 0));
        
        if (!this.isValidNumber(finalProbability)) {
          Logger.error('RAINBOW', 'Некорректная финальная вероятность', finalProbability);
          finalProbability = 0;
        }
      } catch (probError) {
        Logger.error('RAINBOW', 'Ошибка расчета вероятности', probError);
        finalProbability = 0;
      }
      
      // 7. Направление радуги
      const rainbowDirection = this.calculateRainbowDirection(sunPosition);
      
      // 8. Качество радуги
      const rainbowQuality = this.calculateRainbowQuality(
        finalProbability, 
        sunPosition, 
        weather
      );
      
      const result = {
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
      
      Logger.success('RAINBOW', 'Расчет вероятности радуги завершен', {
        probability: result.probability,
        quality: result.quality,
        sunAngle: sunPosition.altitude,
        direction: result.direction
      });
      
      return result;
      
    } catch (error) {
      Logger.error('RAINBOW', 'Ошибка в calculateRainbowProbability', error);
      return {
        probability: 0,
        direction: null,
        quality: 'none',
        sunPosition: null,
        factors: { reason: 'Ошибка расчета' },
        conditions: [{ type: 'critical', message: 'Ошибка в расчетах' }],
        recommendations: ['Попробуйте обновить данные']
      };
    }
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
   * Расчет погодных факторов (УЛУЧШЕННЫЙ С АНАЛИЗОМ НЕДАВНИХ ОСАДКОВ)
   */
  static calculateWeatherFactors(weather) {
    const factors = {
      rainFactor: 0,
      humidityFactor: 0,
      cloudFactor: 0,
      visibilityFactor: 0,
      windFactor: 0,
      temperatureFactor: 0,
      recentRainFactor: 0, // НОВЫЙ ФАКТОР
      sunlightFactor: 0    // НОВЫЙ ФАКТОР
    };
    
    // 1. УЛУЧШЕННЫЙ Фактор дождя/осадков + недавние осадки
    const precipitation = weather.rain ? weather.rain['1h'] || 0 : 0;
    const description = weather.weather[0].description.toLowerCase();
    
    // 🌧️ НАУЧНОЕ ОБНОВЛЕНИЕ: Недавний дождь НЕ критичен через 2+ часа!
    // Радуга может появиться из других источников влаги: туман, испарение, морские брызги
    if (weather.recentRain) {
      const recent = weather.recentRain;
      
      if (recent.isOptimal) {
        factors.recentRainFactor = 1.0; // Дождь был в последний час - ОТЛИЧНО!
      } else if (recent.hasRecentRain && recent.timeSinceRain < 2) {
        factors.recentRainFactor = 0.9; // Дождь был 1-2 часа назад - все еще хорошо
      } else if (recent.hasRecentRain && recent.timeSinceRain < 4) {
        factors.recentRainFactor = 0.7; // Дождь был 2-4 часа назад - нормально
      } else if (recent.hasRecentRain && recent.timeSinceRain < 8) {
        factors.recentRainFactor = 0.5; // Дождь был 4-8 часов назад - возможно
      } else if (recent.hasRecentRain) {
        factors.recentRainFactor = 0.3; // Дождь был давно - слабый бонус
      }
    }
    
    // Фактор текущего солнечного света
    if (description.includes('ясно') || description.includes('clear') || 
        description.includes('солнечно') || description.includes('sunny')) {
      factors.sunlightFactor = 1.0; // Сейчас светит солнце - ОТЛИЧНО!
    } else if (description.includes('переменная') || description.includes('partly')) {
      factors.sunlightFactor = 0.8; // Переменная облачность
    } else if (weather.clouds.all < 50) {
      factors.sunlightFactor = 0.7; // Не очень облачно
    } else if (weather.clouds.all < 80) {
      factors.sunlightFactor = 0.4; // Облачно, но солнце может пробиваться
    } else {
      factors.sunlightFactor = 0.1; // Очень облачно
    }
    
    // Традиционный фактор текущих осадков
    if (description.includes('дождь') || description.includes('rain')) {
      if (description.includes('легкий') || description.includes('light')) {
        factors.rainFactor = 0.3; // Текущий дождь мешает видеть радугу
      } else {
        factors.rainFactor = 0.1; // Сильный дождь - плохо для видимости
      }
    } else if (description.includes('туман') || description.includes('mist')) {
      factors.rainFactor = 0.6; // Туман может создать радугу
    } else if (weather.main.humidity > 70) {
      factors.rainFactor = 0.6; // Высокая влажность - есть капли в воздухе
    } else if (weather.main.humidity > 50) {
      factors.rainFactor = 0.4; // Умеренная влажность - возможны капли
    } else {
      factors.rainFactor = 0.2; // Низкая влажность - но все еще возможно
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
   * Расчет базовой вероятности (УЛУЧШЕННЫЙ АЛГОРИТМ)
   */
  static calculateBaseProbability(sunAngleFactor, weatherFactors, atmosphericFactors) {
    // 🌈 ОПЫТ + НАУКА: взвешенная сумма факторов  
    // Основано на РЕАЛЬНОМ ОПЫТЕ пользователя: "радуга всегда после дождя!"
    const weightedSum = 
      weatherFactors.recentRainFactor * 0.40 + // 40% - НЕДАВНИЕ ОСАДКИ (САМОЕ ВАЖНОЕ по опыту!)
      sunAngleFactor * 0.30 + // 30% - угол солнца (критичный физический фактор!)
      weatherFactors.sunlightFactor * 0.15 + // 15% - текущий солнечный свет (важно для видимости)
      weatherFactors.cloudFactor * 0.08 + // 8% - облачность (баланс)
      weatherFactors.visibilityFactor * 0.04 + // 4% - видимость 
      weatherFactors.humidityFactor * 0.02 + // 2% - влажность
      weatherFactors.rainFactor * 0.005 + // 0.5% - текущие осадки
      atmosphericFactors.lightScatteringFactor * 0.005; // 0.5% - рассеяние света
    
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
   * Генерация рекомендаций (УЛУЧШЕННАЯ ВЕРСИЯ)
   */
  static generateRecommendations(probability, sunPosition, weather, solarEvents) {
    const recommendations = [];
    
    if (probability > 80) {
      recommendations.push('🌟 СУПЕР условия! Радуга очень вероятна!');
      recommendations.push(`🧭 Смотрите в направлении ${Math.round((sunPosition.azimuth + 180) % 360)}°`);
      if (weather.recentRain?.isOptimal) {
        recommendations.push('💧 Недавний дождь + солнце = идеальные условия!');
      }
    } else if (probability > 60) {
      recommendations.push('✅ Отличные условия для поиска радуги!');
      recommendations.push(`🧭 Направление: ${Math.round((sunPosition.azimuth + 180) % 360)}°`);
    } else if (probability > 40) {
      recommendations.push('🟡 Умеренные условия, следите за небом');
    } else if (probability > 20) {
      recommendations.push('🔍 Слабые условия, но радуга возможна');
    } else {
      recommendations.push('❌ Условия для радуги неблагоприятны');
    }
    
    // Рекомендации по времени
    if (sunPosition.altitude > this.CRITICAL_SUN_ANGLE) {
      const sunset = solarEvents.sunset;
      if (sunset) {
        recommendations.push(`⏰ Попробуйте после ${sunset.getHours()}:${sunset.getMinutes().toString().padStart(2, '0')} (закат)`);
      }
    }
    
    // Специальные рекомендации на основе анализа
    if (weather.recentRain) {
      if (!weather.recentRain.hasRecentRain) {
        recommendations.push('🌧️ Дождитесь дождя, затем ясной погоды');
      } else if (weather.recentRain.timeSinceRain > 2) {
        recommendations.push('⏳ Дождь был давно, нужен более свежий');
      }
    }
    
    // Рекомендации по солнцу
    if (weather.clouds?.all > 80) {
      recommendations.push('☀️ Дождитесь, когда солнце пробьется через облака');
    }
    
    return recommendations;
  }

  /**
   * Оценка UV индекса (приблизительная)
   */
  static estimateUVIndex(weather, latitude) {
    if (!weather || !weather.clouds || typeof latitude !== 'number') {
      return 0;
    }
    
    const cloudiness = Math.max(0, Math.min(100, weather.clouds.all || 0));
    const baseUV = Math.max(0, 10 - Math.abs(latitude) / 9);
    return baseUV * (1 - cloudiness / 100);
  }

  /**
   * Проверка корректности числа
   */
  static isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * Проверка всех факторов на корректность
   */
  static validateFactors(factors) {
    try {
      // Проверяем базовые числовые факторы
      if (!this.isValidNumber(factors.sunAngleFactor)) {
        Logger.error('RAINBOW', 'Некорректный sunAngleFactor', factors.sunAngleFactor);
        return false;
      }

      // Проверяем временные факторы
      if (!factors.timeFactors || 
          !this.isValidNumber(factors.timeFactors.timeOfDayFactor) ||
          !this.isValidNumber(factors.timeFactors.seasonalFactor)) {
        Logger.error('RAINBOW', 'Некорректные timeFactors', factors.timeFactors);
        return false;
      }

      // Проверяем погодные факторы
      if (!factors.weatherFactors || typeof factors.weatherFactors !== 'object') {
        Logger.error('RAINBOW', 'Некорректные weatherFactors', factors.weatherFactors);
        return false;
      }

      // Проверяем атмосферные факторы
      if (!factors.atmosphericFactors || 
          !this.isValidNumber(factors.atmosphericFactors.lightScatteringFactor)) {
        Logger.error('RAINBOW', 'Некорректные atmosphericFactors', factors.atmosphericFactors);
        return false;
      }

      // Проверяем геометрические факторы
      if (!factors.geometricFactors || 
          !this.isValidNumber(factors.geometricFactors.lightScatteringFactor) ||
          !this.isValidNumber(factors.geometricFactors.dropletDistributionFactor)) {
        Logger.error('RAINBOW', 'Некорректные geometricFactors', factors.geometricFactors);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('RAINBOW', 'Ошибка валидации факторов', error);
      return false;
    }
  }

  /**
   * Безопасное деление
   */
  static safeDivide(dividend, divisor, defaultValue = 0) {
    if (!this.isValidNumber(dividend) || !this.isValidNumber(divisor) || divisor === 0) {
      return defaultValue;
    }
    const result = dividend / divisor;
    return this.isValidNumber(result) ? result : defaultValue;
  }

  /**
   * Безопасное умножение
   */
  static safeMultiply(a, b, defaultValue = 0) {
    if (!this.isValidNumber(a) || !this.isValidNumber(b)) {
      return defaultValue;
    }
    const result = a * b;
    return this.isValidNumber(result) ? result : defaultValue;
  }
} 