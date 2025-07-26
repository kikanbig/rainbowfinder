/**
 * �� Kate's Rainbow Backend
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { WeatherMonitorService } = require('./services/WeatherMonitorService');
const { NotificationService } = require('./services/NotificationService');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Инициализация сервисов
async function initializeServices() {
  console.log('🚀 Инициализация сервисов...');
  await WeatherMonitorService.initialize?.();
  console.log('✅ Сервисы инициализированы');
}

// Настройка cron задач
function setupCronJobs() {
  console.log('⏰ Настройка cron задач...');
  
  // 🌈 Проверка радуги каждые 5 минут
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔍 Проверка условий радуги...');
    await WeatherMonitorService.checkAllLocations();
  });
  
  // 🔄 Сброс счетчика API в полночь
  cron.schedule('0 0 * * *', () => {
    WeatherMonitorService.resetDailyApiCount();
  });
  
  console.log('✅ Cron задачи настроены (каждые 5 минут)');
}

// Запуск сервера
async function startServer() {
  try {
    await initializeServices();
    setupCronJobs();
    
    app.listen(PORT, () => {
      console.log(`🌈 Kate's Rainbow Backend запущен на порту ${PORT}`);
      console.log(`🔗 Health: http://localhost:${PORT}/health`);
      console.log(`📱 API: http://localhost:${PORT}/api/notifications`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска:', error);
    process.exit(1);
  }
}

startServer();
