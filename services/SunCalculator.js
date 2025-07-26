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
    const julianDay = this.getJulianDay(date);
    const T = (julianDay - this.J2000) / 36525.0; // Centuries since J2000.0

    // Геометрическая долгота солнца
    const L0 = this.getGeometricMeanLongitudeSun(T);
    
    // Эксцентриситет орбиты Земли
    const e = this.getEarthOrbitEccentricity(T);
    
    // Средняя аномалия солнца
    const M = this.getSunMeanAnomaly(T);
    
    // Уравнение центра
    const C = this.getSunEquationOfCenter(T, M);
    
    // Истинная долгота солнца
    const trueLongitude = L0 + C;
    
    // Кажущаяся долгота солнца
    const omega = 125.04452 - 1934.136261 * T;
    const lambda = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * this.DEGREES_TO_RADIANS);
    
    // Наклон эклиптики
    const epsilon = this.getMeanObliquityOfEcliptic(T);
    
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
   * Вычисляет все солнечные события для дня
   */
  static calculateSolarEvents(latitude, longitude, date = new Date()) {
    const julianDay = this.getJulianDay(date);
    const T = (julianDay - this.J2000) / 36525.0;
    
    // Приблизительное время транзита
    const meanSolarNoon = julianDay - longitude / 360.0;
    
    // Уравнение времени
    const equationOfTime = this.getEquationOfTime(T);
    
    // Склонение солнца в полдень
    const solarNoonPosition = this.calculateSunPosition(latitude, longitude, 
      new Date((meanSolarNoon - 2440587.5) * 86400000));
    
    // Часовой угол восхода/заката
    const latRad = latitude * this.DEGREES_TO_RADIANS;
    const decRad = solarNoonPosition.declination * this.DEGREES_TO_RADIANS;
    
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
    
    if (Math.abs(cosHourAngle) > 1) {
      // Полярная ночь или полярный день
      return {
        sunrise: null,
        sunset: null,
        solarNoon: new Date((meanSolarNoon - 2440587.5) * 86400000),
        isPolarNight: cosHourAngle > 1,
        isPolarDay: cosHourAngle < -1
      };
    }
    
    const hourAngle = Math.acos(cosHourAngle) * this.RADIANS_TO_DEGREES;
    
    const sunrise = meanSolarNoon - hourAngle / 360.0;
    const sunset = meanSolarNoon + hourAngle / 360.0;
    
    // Сумерки
    const civilTwilightAngle = -6; // градусы
    const nauticalTwilightAngle = -12;
    const astronomicalTwilightAngle = -18;
    
    const twilightTimes = this.calculateTwilightTimes(
      latitude, longitude, date, 
      [civilTwilightAngle, nauticalTwilightAngle, astronomicalTwilightAngle]
    );

    return {
      sunrise: new Date((sunrise - 2440587.5) * 86400000),
      sunset: new Date((sunset - 2440587.5) * 86400000),
      solarNoon: new Date((meanSolarNoon - 2440587.5) * 86400000),
      civilDawn: twilightTimes.civilDawn,
      civilDusk: twilightTimes.civilDusk,
      nauticalDawn: twilightTimes.nauticalDawn,
      nauticalDusk: twilightTimes.nauticalDusk,
      astronomicalDawn: twilightTimes.astronomicalDawn,
      astronomicalDusk: twilightTimes.astronomicalDusk,
      isPolarNight: false,
      isPolarDay: false
    };
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