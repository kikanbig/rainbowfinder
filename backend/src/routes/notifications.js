/**
 * 📱 API роуты для уведомлений
 */
const express = require('express');
const { NotificationService } = require('../services/NotificationService');
const { WeatherMonitorService } = require('../services/WeatherMonitorService');

const router = express.Router();

// Регистрация push токена
router.post('/register', async (req, res) => {
  try {
    const result = await NotificationService.registerUser(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(400).json({ error: error.message });
  }
});

// Обновление локации пользователя
router.post('/update-location', async (req, res) => {
  try {
    const { pushToken, location } = req.body;
    
    // Обновляем локацию пользователя
    await NotificationService.updateUserLocation(pushToken, location);
    
    // Добавляем локацию в мониторинг
    WeatherMonitorService.addLocationToMonitor({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка обновления локации:', error);
    res.status(400).json({ error: error.message });
  }
});

// Статистика
router.get('/stats', (req, res) => {
  res.json({
    users: NotificationService.getStats?.() || { totalUsers: 0 },
    api: WeatherMonitorService.getApiStats?.() || { apiCallsToday: 0 }
  });
});

module.exports = router;
