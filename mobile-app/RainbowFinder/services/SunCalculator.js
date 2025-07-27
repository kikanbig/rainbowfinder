/**
 * Точный астрономический калькулятор положения солнца
 * Основан на алгоритмах Жана Мееуса "Astronomical Algorithms"
 */

export class SunCalculator {
  // Константы
  static DEGREES_TO_RADIANS = Math.PI / 180;
  static RADIANS_TO_DEGREES = 180 / Math.PI;
  static J2000 = 2451545.0; // Julian date of J2000.0 epoch

  /**
   * Вычисляет точное положение солнца
   */
  static calculateSunPosition(latitude, longitude, date = new Date()) {
    const julianDay = SunCalculator.getJulianDay(date);
    const T = (julianDay - SunCalculator.J2000) / 36525.0; // Centuries since J2000.0

    // Геометрическая долгота солнца
    const L0 = SunCalculator.getGeometricMeanLongitudeSun(T);
    
    // Эксцентриситет орбиты Земли
    const e = SunCalculator.getEarthOrbitEccentricity(T);
    
    // Средняя аномалия солнца
    const M = SunCalculator.getSunMeanAnomaly(T);
    
    // Уравнение центра
    const C = SunCalculator.getSunEquationOfCenter(T, M);
    
    // Истинная долгота солнца
    const trueLongitude = L0 + C;
    
    // Кажущаяся долгота солнца
    const omega = 125.04452 - 1934.136261 * T;
    const lambda = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * this.DEGREES_TO_RADIANS);
    
    // Наклон эклиптики
    const epsilon = SunCalculator.getMeanObliquityOfEcliptic(T);
    
    // Склонение солнца
    const declination = Math.asin(Math.sin(epsilon * this.DEGREES_TO_RADIANS) * 
                                 Math.sin(lambda * this.DEGREES_TO_RADIANS)) * this.RADIANS_TO_DEGREES;
    
    // Прямое восхождение
    const rightAscension = Math.atan2(Math.cos(epsilon * this.DEGREES_TO_RADIANS) * 
                                     Math.sin(lambda * this.DEGREES_TO_RADIANS),
                                     Math.cos(lambda * this.DEGREES_TO_RADIANS)) * this.RADIANS_TO_DEGREES;
    
    // Гринвичское звездное время
    const gmst = this.getGreenwichMeanSiderealTime(julianDay);
    
    // Местное звездное время
    const lst = gmst + longitude;
    
    // Часовой угол
    const hourAngle = lst - rightAscension;
    
    // Азимут и высота
    const latRad = latitude * this.DEGREES_TO_RADIANS;
    const decRad = declination * this.DEGREES_TO_RADIANS;
    const haRad = hourAngle * this.DEGREES_TO_RADIANS;
    
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + 
                   Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    
    const altitude = Math.asin(sinAlt) * this.RADIANS_TO_DEGREES;
    
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / 
                  (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * this.RADIANS_TO_DEGREES;
    
    if (Math.sin(haRad) > 0) {
      azimuth = 360 - azimuth;
    }

    return {
      altitude: altitude,
      azimuth: azimuth,
      declination: declination,
      rightAscension: rightAscension,
      julianDay: julianDay,
      gmst: gmst,
      hourAngle: hourAngle
    };
  }

  /**
   * Вычисляет все солнечные события для дня (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   */
  static calculateSolarEvents(latitude, longitude, date = new Date()) {
    // Используем упрощенный, но точный алгоритм
    return this.calculateSunriseSunsetSimple(latitude, longitude, date);
  }

  /**
   * Упрощенный и точный расчет восхода/заката (ИСПРАВЛЕННЫЙ ЧАСОВОЙ ПОЯС)
   */
  static calculateSunriseSunsetSimple(lat, lng, date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Номер дня в году
    const N = Math.floor((275 * month) / 9) - Math.floor((month + 9) / 12) * (1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3)) + day - 30;
    
    // ИСПРАВЛЕНИЕ: Учитываем реальный часовой пояс устройства
    const timezoneOffsetHours = -date.getTimezoneOffset() / 60; // Инверсия для правильного знака
    const lngHour = lng / 15;
    
    // Примерное время восхода и заката
    const tSunrise = N + ((6 - lngHour) / 24);
    const tSunset = N + ((18 - lngHour) / 24);
    
    // Средняя аномалия солнца
    const MSunrise = (0.9856 * tSunrise) - 3.289;
    const MSunset = (0.9856 * tSunset) - 3.289;
    
    // Истинная долгота солнца
    const LSunrise = MSunrise + (1.916 * Math.sin(MSunrise * this.DEGREES_TO_RADIANS)) + (0.020 * Math.sin(2 * MSunrise * this.DEGREES_TO_RADIANS)) + 282.634;
    const LSunset = MSunset + (1.916 * Math.sin(MSunset * this.DEGREES_TO_RADIANS)) + (0.020 * Math.sin(2 * MSunset * this.DEGREES_TO_RADIANS)) + 282.634;
    
    // Нормализация
    const LNormSunrise = this.normalizeDegrees(LSunrise);
    const LNormSunset = this.normalizeDegrees(LSunset);
    
    // Прямое восхождение солнца
    const RASunrise = this.normalizeDegrees(Math.atan(0.91764 * Math.tan(LNormSunrise * this.DEGREES_TO_RADIANS)) * this.RADIANS_TO_DEGREES);
    const RASunset = this.normalizeDegrees(Math.atan(0.91764 * Math.tan(LNormSunset * this.DEGREES_TO_RADIANS)) * this.RADIANS_TO_DEGREES);
    
    // Корректировка квадранта
    const LquadrantSunrise = (Math.floor(LNormSunrise / 90)) * 90;
    const RAquadrantSunrise = (Math.floor(RASunrise / 90)) * 90;
    const RACorrectedSunrise = RASunrise + (LquadrantSunrise - RAquadrantSunrise);
    
    const LquadrantSunset = (Math.floor(LNormSunset / 90)) * 90;
    const RAquadrantSunset = (Math.floor(RASunset / 90)) * 90;
    const RACorrectedSunset = RASunset + (LquadrantSunset - RAquadrantSunset);
    
    // Преобразование в часы
    const RAHoursSunrise = RACorrectedSunrise / 15;
    const RAHoursSunset = RACorrectedSunset / 15;
    
    // Склонение солнца
    const sinDecSunrise = 0.39782 * Math.sin(LNormSunrise * this.DEGREES_TO_RADIANS);
    const cosDecSunrise = Math.cos(Math.asin(sinDecSunrise));
    
    const sinDecSunset = 0.39782 * Math.sin(LNormSunset * this.DEGREES_TO_RADIANS);
    const cosDecSunset = Math.cos(Math.asin(sinDecSunset));
    
    // Часовой угол солнца
    const zenith = 90.833; // официальный зенит для восхода/заката
    const cosHSunrise = (Math.cos(zenith * this.DEGREES_TO_RADIANS) - (sinDecSunrise * Math.sin(lat * this.DEGREES_TO_RADIANS))) / (cosDecSunrise * Math.cos(lat * this.DEGREES_TO_RADIANS));
    const cosHSunset = (Math.cos(zenith * this.DEGREES_TO_RADIANS) - (sinDecSunset * Math.sin(lat * this.DEGREES_TO_RADIANS))) / (cosDecSunset * Math.cos(lat * this.DEGREES_TO_RADIANS));
    
    if (Math.abs(cosHSunrise) > 1 || Math.abs(cosHSunset) > 1) {
      // Полярный день или ночь
      return {
        sunrise: null,
        sunset: null,
        solarNoon: null,
        isPolarNight: cosHSunrise > 1,
        isPolarDay: cosHSunrise < -1
      };
    }
    
    // Часовой угол в часах
    const HSunrise = 360 - Math.acos(cosHSunrise) * this.RADIANS_TO_DEGREES;
    const HSunset = Math.acos(cosHSunset) * this.RADIANS_TO_DEGREES;
    
    const HHoursSunrise = HSunrise / 15;
    const HHoursSunset = HSunset / 15;
    
    // Местное время
    const TSunrise = HHoursSunrise + RAHoursSunrise - (0.06571 * tSunrise) - 6.622;
    const TSunset = HHoursSunset + RAHoursSunset - (0.06571 * tSunset) - 6.622;
    
         // Корректировка UTC и приведение к местному времени
     const UTCSunrise = TSunrise - lngHour;
     const UTCSunset = TSunset - lngHour;
     
     // ИСПРАВЛЕНИЕ: Добавляем часовой пояс устройства
     const localSunrise = this.normalizeTime(UTCSunrise + timezoneOffsetHours);
     const localSunset = this.normalizeTime(UTCSunset + timezoneOffsetHours);
    
    // Солнечный полдень (приблизительно)
    const solarNoonTime = (localSunrise + localSunset) / 2;
    
    // Создаем объекты Date для текущего дня
    const sunriseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    sunriseDate.setHours(Math.floor(localSunrise), Math.floor((localSunrise % 1) * 60), 0, 0);
    
    const sunsetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    sunsetDate.setHours(Math.floor(localSunset), Math.floor((localSunset % 1) * 60), 0, 0);
    
    const solarNoonDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    solarNoonDate.setHours(Math.floor(solarNoonTime), Math.floor((solarNoonTime % 1) * 60), 0, 0);
    
    return {
      sunrise: sunriseDate,
      sunset: sunsetDate,
      solarNoon: solarNoonDate,
      isPolarNight: false,
      isPolarDay: false
    };
  }

  /**
   * Нормализация градусов (0-360)
   */
  static normalizeDegrees(degrees) {
    let normalized = degrees;
    while (normalized < 0) normalized += 360;
    while (normalized >= 360) normalized -= 360;
    return normalized;
  }

  /**
   * Нормализация времени (0-24)
   */
  static normalizeTime(time) {
    let normalized = time;
    while (normalized < 0) normalized += 24;
    while (normalized >= 24) normalized -= 24;
    return normalized;
  }

  // Вспомогательные функции

  static getJulianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  static getGeometricMeanLongitudeSun(T) {
    let L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
    while (L0 > 360) L0 -= 360;
    while (L0 < 0) L0 += 360;
    return L0;
  }

  static getEarthOrbitEccentricity(T) {
    return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  }

  static getSunMeanAnomaly(T) {
    return 357.52911 + T * (35999.05029 - 0.0001537 * T);
  }

  static getSunEquationOfCenter(T, M) {
    const Mrad = M * this.DEGREES_TO_RADIANS;
    return Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
           Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
           Math.sin(3 * Mrad) * 0.000289;
  }

  static getMeanObliquityOfEcliptic(T) {
    return 23.439291 - T * (0.0130042 + T * (0.00000016 - T * 0.000000504));
  }

  static getGreenwichMeanSiderealTime(julianDay) {
    const T = (julianDay - this.J2000) / 36525.0;
    let gmst = 280.46061837 + 360.98564736629 * (julianDay - this.J2000) +
               T * T * (0.000387933 - T / 38710000.0);
    
    while (gmst > 360) gmst -= 360;
    while (gmst < 0) gmst += 360;
    
    return gmst;
  }

  static getEquationOfTime(T) {
    const epsilon = this.getMeanObliquityOfEcliptic(T) * this.DEGREES_TO_RADIANS;
    const L0 = this.getGeometricMeanLongitudeSun(T) * this.DEGREES_TO_RADIANS;
    const e = this.getEarthOrbitEccentricity(T);
    const M = this.getSunMeanAnomaly(T) * this.DEGREES_TO_RADIANS;

    const y = Math.tan(epsilon / 2);
    const y2 = y * y;

    const sin2L0 = Math.sin(2 * L0);
    const sinM = Math.sin(M);
    const cos2L0 = Math.cos(2 * L0);
    const sin4L0 = Math.sin(4 * L0);
    const sin2M = Math.sin(2 * M);

    const Etime = y2 * sin2L0 - 2 * e * sinM + 4 * e * y * sinM * cos2L0 -
                  0.5 * y2 * y2 * sin4L0 - 1.25 * e * e * sin2M;

    return Etime * this.RADIANS_TO_DEGREES * 4; // в минутах
  }

  static calculateTwilightTimes(latitude, longitude, date, angles) {
    const results = {};
    
    angles.forEach((angle, index) => {
      const names = ['civil', 'nautical', 'astronomical'];
      const name = names[index];
      
      const times = this.calculateEventForAngle(latitude, longitude, date, angle);
      results[`${name}Dawn`] = times.dawn;
      results[`${name}Dusk`] = times.dusk;
    });
    
    return results;
  }

  static calculateEventForAngle(latitude, longitude, date, angle) {
    // Упрощенный расчет для сумерек
    const julianDay = this.getJulianDay(date);
    const meanSolarNoon = julianDay - longitude / 360.0;
    
    const latRad = latitude * this.DEGREES_TO_RADIANS;
    const angleRad = angle * this.DEGREES_TO_RADIANS;
    
    // Приближенное склонение
    const T = (julianDay - this.J2000) / 36525.0;
    const L = this.getGeometricMeanLongitudeSun(T) * this.DEGREES_TO_RADIANS;
    const epsilon = this.getMeanObliquityOfEcliptic(T) * this.DEGREES_TO_RADIANS;
    const declination = Math.asin(Math.sin(epsilon) * Math.sin(L));
    
    const cosHourAngle = (Math.sin(angleRad) - Math.sin(latRad) * Math.sin(declination)) /
                         (Math.cos(latRad) * Math.cos(declination));
    
    if (Math.abs(cosHourAngle) > 1) {
      return { dawn: null, dusk: null };
    }
    
    const hourAngle = Math.acos(cosHourAngle) * this.RADIANS_TO_DEGREES;
    
    const dawn = meanSolarNoon - hourAngle / 360.0;
    const dusk = meanSolarNoon + hourAngle / 360.0;
    
    return {
      dawn: new Date((dawn - 2440587.5) * 86400000),
      dusk: new Date((dusk - 2440587.5) * 86400000)
    };
  }
} 