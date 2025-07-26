/**
 * 🌦️ Сервис мониторинга погоды
 */
const axios = require('axios');
const { NotificationService } = require('./NotificationService');

class WeatherMonitorService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.monitoredLocations = new Map();
    this.apiCallCount = 0;
    this.dailyApiLimit = 900;
  }

  addLocationToMonitor(location) {
    const key = `${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}`;
    this.monitoredLocations.set(key, location);
  }

  async checkAllLocations() {
    console.log(`🔍 Проверяем ${this.monitoredLocations.size} локаций...`);
    
    for (const location of this.monitoredLocations.values()) {
      await this.checkLocationForRainbow(location);
    }
  }

  async checkLocationForRainbow(location) {
    try {
      const weather = await this.getWeatherData(location.latitude, location.longitude);
      if (!weather) return;

      const probability = this.calculateRainbowProbability(weather);
      console.log(`🌈 ${location.name}: ${probability}% вероятность радуги`);

      if (probability >= 80) {
        await NotificationService.sendRainbowAlert(location, probability);
      }
    } catch (error) {
      console.error(`❌ Ошибка проверки ${location.name}:`, error.message);
    }
  }

  async getWeatherData(lat, lon) {
    if (this.apiCallCount >= this.dailyApiLimit) {
      console.log('⚠️ Достигнут лимит API');
      return null;
    }

    try {
      this.apiCallCount++;
      const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { lat, lon, appid: this.apiKey, units: 'metric' }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка API:', error.message);
      return null;
    }
  }

  calculateRainbowProbability(weather) {
    let probability = 0;
    
    const humidity = weather.main?.humidity || 0;
    const clouds = weather.clouds?.all || 0;
    const hasRain = weather.weather?.some(w => w.main === 'Rain');

    if (humidity > 70) probability += 40; // Высокий вес по требованию
    if (clouds > 20 && clouds < 80) probability += 30;
    if (hasRain) probability += 30;

    return Math.min(probability, 100);
  }

  resetDailyApiCount() {
    this.apiCallCount = 0;
    console.log('🔄 Счетчик API сброшен');
  }
}

module.exports = { WeatherMonitorService: new WeatherMonitorService() };
