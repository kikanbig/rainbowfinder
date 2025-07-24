/**
 * SunCalculator - Расчет положения солнца и солнечных времен
 * 
 * Основан на астрономических алгоритмах для точного определения:
 * - Высоты солнца над горизонтом (альтитуда)
 * - Азимута солнца
 * - Времени восхода и заката
 * - Солнечного полудня
 */

export interface SunPosition {
  altitude: number;    // Высота над горизонтом в градусах
  azimuth: number;     // Азимут в градусах (0° = север)
  distance: number;    // Расстояние до солнца в астрономических единицах
}

export interface SunTimes {
  sunrise: Date;       // Время восхода
  sunset: Date;        // Время заката
  solarNoon: Date;     // Солнечный полдень
  dawn: Date;          // Рассвет (гражданские сумерки)
  dusk: Date;          // Сумерки (гражданские сумерки)
  goldenHourStart: Date;  // Начало золотого часа
  goldenHourEnd: Date;    // Конец золотого часа
}

export class SunCalculator {
  
  private static readonly DEGREES_TO_RADIANS = Math.PI / 180;
  private static readonly RADIANS_TO_DEGREES = 180 / Math.PI;
  
  /**
   * Расчет текущего положения солнца
   */
  static calculateSunPosition(latitude: number, longitude: number, date: Date = new Date()): SunPosition {
    const julianDay = this.getJulianDay(date);
    const n = julianDay - 2451545.0;
    
    // Средняя аномалия
    const L = (280.460 + 0.9856474 * n) % 360;
    const M = (357.528 + 0.9856003 * n) % 360;
    const Mrad = M * this.DEGREES_TO_RADIANS;
    
    // Эклиптическая долгота солнца
    const lambda = (L + 1.915 * Math.sin(Mrad) + 0.020 * Math.sin(2 * Mrad)) % 360;
    const lambdaRad = lambda * this.DEGREES_TO_RADIANS;
    
    // Наклон земной оси
    const obliquity = 23.439 - 0.0000004 * n;
    const obliquityRad = obliquity * this.DEGREES_TO_RADIANS;
    
    // Экваториальные координаты
    const alpha = Math.atan2(Math.cos(obliquityRad) * Math.sin(lambdaRad), Math.cos(lambdaRad));
    const delta = Math.asin(Math.sin(obliquityRad) * Math.sin(lambdaRad));
    
    // Звездное время
    const gmst = (280.460 + 360.9856235 * n) % 360;
    const lst = (gmst + longitude) % 360;
    const lstRad = lst * this.DEGREES_TO_RADIANS;
    
    // Часовой угол
    const H = lstRad - alpha;
    
    // Горизонтальные координаты
    const latRad = latitude * this.DEGREES_TO_RADIANS;
    
    const altitude = Math.asin(
      Math.sin(latRad) * Math.sin(delta) + 
      Math.cos(latRad) * Math.cos(delta) * Math.cos(H)
    ) * this.RADIANS_TO_DEGREES;
    
    const azimuth = (Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(latRad) - Math.tan(delta) * Math.cos(latRad)
    ) * this.RADIANS_TO_DEGREES + 180) % 360;
    
    // Расстояние до солнца (приблизительно)
    const distance = 1.00014 - 0.01671 * Math.cos(Mrad) - 0.00014 * Math.cos(2 * Mrad);
    
    return {
      altitude,
      azimuth,
      distance
    };
  }
  
  /**
   * Расчет времени восхода, заката и других солнечных событий
   */
  static calculateSunTimes(latitude: number, longitude: number, date: Date = new Date()): SunTimes {
    const julianDay = this.getJulianDay(date);
    const n = Math.round(julianDay - 2451545.0 + 0.0008);
    const Js = n - longitude / 360;
    
    // Средняя аномалия
    const M = (357.5291 + 0.98560028 * Js) % 360;
    const Mrad = M * this.DEGREES_TO_RADIANS;
    
    // Уравнение центра
    const C = 1.9148 * Math.sin(Mrad) + 0.0200 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad);
    
    // Эклиптическая долгота
    const lambda = (M + 102.9372 + C + 180) % 360;
    const lambdaRad = lambda * this.DEGREES_TO_RADIANS;
    
    // Склонение солнца
    const delta = Math.asin(Math.sin(lambdaRad) * Math.sin(23.45 * this.DEGREES_TO_RADIANS));
    
    // Часовой угол для восхода/заката
    const latRad = latitude * this.DEGREES_TO_RADIANS;
    const hourAngle = Math.acos(
      (Math.sin(-0.833 * this.DEGREES_TO_RADIANS) - Math.sin(latRad) * Math.sin(delta)) /
      (Math.cos(latRad) * Math.cos(delta))
    ) * this.RADIANS_TO_DEGREES;
    
    // Часовой угол для гражданских сумерек
    const civilTwilightAngle = Math.acos(
      (Math.sin(-6 * this.DEGREES_TO_RADIANS) - Math.sin(latRad) * Math.sin(delta)) /
      (Math.cos(latRad) * Math.cos(delta))
    ) * this.RADIANS_TO_DEGREES;
    
    // Часовой угол для золотого часа
    const goldenHourAngle = Math.acos(
      (Math.sin(-4 * this.DEGREES_TO_RADIANS) - Math.sin(latRad) * Math.sin(delta)) /
      (Math.cos(latRad) * Math.cos(delta))
    ) * this.RADIANS_TO_DEGREES;
    
    // Солнечный полдень
    const Jt = 2451545.0 + Js + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);
    const solarNoon = this.julianToDate(Jt);
    
    // Времена восхода и заката
    const sunrise = this.julianToDate(Jt - hourAngle / 360);
    const sunset = this.julianToDate(Jt + hourAngle / 360);
    
    // Гражданские сумерки
    const dawn = this.julianToDate(Jt - civilTwilightAngle / 360);
    const dusk = this.julianToDate(Jt + civilTwilightAngle / 360);
    
    // Золотой час
    const goldenHourStart = this.julianToDate(Jt - goldenHourAngle / 360);
    const goldenHourEnd = this.julianToDate(Jt + goldenHourAngle / 360);
    
    return {
      sunrise,
      sunset,
      solarNoon,
      dawn,
      dusk,
      goldenHourStart,
      goldenHourEnd
    };
  }
  
  /**
   * Проверка, является ли время дневным
   */
  static isDaytime(latitude: number, longitude: number, date: Date = new Date()): boolean {
    const position = this.calculateSunPosition(latitude, longitude, date);
    return position.altitude > 0;
  }
  
  /**
   * Проверка оптимального времени для радуги
   */
  static isOptimalRainbowTime(latitude: number, longitude: number, date: Date = new Date()): boolean {
    const position = this.calculateSunPosition(latitude, longitude, date);
    const times = this.calculateSunTimes(latitude, longitude, date);
    
    const currentTime = date.getTime();
    const sunrise = times.sunrise.getTime();
    const sunset = times.sunset.getTime();
    
    // Угол солнца должен быть между 5° и 42°
    if (position.altitude < 5 || position.altitude > 42) {
      return false;
    }
    
    // Лучшее время: утром в течение 3 часов после восхода или вечером за 3 часа до заката
    const morningPeriod = sunrise + (3 * 60 * 60 * 1000); // +3 часа
    const eveningPeriod = sunset - (3 * 60 * 60 * 1000); // -3 часа
    
    return (currentTime >= sunrise && currentTime <= morningPeriod) ||
           (currentTime >= eveningPeriod && currentTime <= sunset);
  }
  
  /**
   * Получение направления антисолярной точки (противоположно солнцу)
   */
  static getAntiSolarDirection(latitude: number, longitude: number, date: Date = new Date()): number {
    const position = this.calculateSunPosition(latitude, longitude, date);
    return (position.azimuth + 180) % 360;
  }
  
  /**
   * Получение направления радуги (42° от антисолярной точки)
   */
  static getRainbowDirection(latitude: number, longitude: number, date: Date = new Date()): number {
    const antiSolarDirection = this.getAntiSolarDirection(latitude, longitude, date);
    return (antiSolarDirection + 42) % 360;
  }
  
  /**
   * Преобразование даты в юлианский день
   */
  private static getJulianDay(date: Date): number {
    const time = date.getTime();
    const tzOffset = date.getTimezoneOffset();
    return (time / 86400000) - (tzOffset / 1440) + 2440588;
  }
  
  /**
   * Преобразование юлианского дня в дату
   */
  private static julianToDate(julianDay: number): Date {
    return new Date((julianDay - 2440588) * 86400000);
  }
  
  /**
   * Нормализация угла в диапазоне 0-360°
   */
  private static normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }
  
  /**
   * Получение информации о времени до следующего восхода/заката
   */
  static getTimeToNextSunEvent(latitude: number, longitude: number, date: Date = new Date()): {
    nextEvent: 'sunrise' | 'sunset';
    timeUntil: number; // в миллисекундах
    eventTime: Date;
  } {
    const times = this.calculateSunTimes(latitude, longitude, date);
    const currentTime = date.getTime();
    
    // Проверяем, какое событие ближе
    const sunriseTime = times.sunrise.getTime();
    const sunsetTime = times.sunset.getTime();
    
    if (currentTime < sunriseTime) {
      // До восхода
      return {
        nextEvent: 'sunrise',
        timeUntil: sunriseTime - currentTime,
        eventTime: times.sunrise
      };
    } else if (currentTime < sunsetTime) {
      // До заката
      return {
        nextEvent: 'sunset',
        timeUntil: sunsetTime - currentTime,
        eventTime: times.sunset
      };
    } else {
      // После заката, ждем завтрашний восход
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowTimes = this.calculateSunTimes(latitude, longitude, tomorrow);
      
      return {
        nextEvent: 'sunrise',
        timeUntil: tomorrowTimes.sunrise.getTime() - currentTime,
        eventTime: tomorrowTimes.sunrise
      };
    }
  }
  
  /**
   * Форматирование направления компаса
   */
  static formatCompassDirection(azimuth: number): string {
    const directions = [
      'С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ',
      'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'
    ];
    
    const index = Math.round(azimuth / 22.5) % 16;
    return directions[index];
  }
} 