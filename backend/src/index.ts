/**
 * RainbowFinder Backend Server
 * 
 * Основной сервер для обработки:
 * - Мониторинг погодных условий
 * - Отправка push уведомлений
 * - Расчет вероятности радуги
 * - API для мобильного приложения
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';

// Services
import { WeatherMonitorService } from './services/WeatherMonitorService';
import { NotificationService } from './services/NotificationService';
import { RainbowCalculatorService } from './services/RainbowCalculatorService';
import { DatabaseService } from './services/DatabaseService';
import { logger } from './utils/logger';

// Routes
import weatherRoutes from './routes/weather';
import rainbowRoutes from './routes/rainbow';
import notificationRoutes from './routes/notifications';
import userRoutes from './routes/users';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { validateApiKey } from './middleware/auth';

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP
  message: 'Слишком много запросов с вашего IP, попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/weather', validateApiKey, weatherRoutes);
app.use('/api/rainbow', validateApiKey, rainbowRoutes);
app.use('/api/notifications', validateApiKey, notificationRoutes);
app.use('/api/users', validateApiKey, userRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Маршрут ${req.method} ${req.originalUrl} не найден`,
  });
});

// Error handler
app.use(errorHandler);

/**
 * Инициализация сервисов
 */
async function initializeServices() {
  try {
    logger.info('Инициализация сервисов...');
    
    // Инициализация базы данных
    await DatabaseService.connect();
    logger.info('✅ База данных подключена');
    
    // Инициализация сервиса уведомлений
    await NotificationService.initialize();
    logger.info('✅ Сервис уведомлений инициализирован');
    
    // Инициализация мониторинга погоды
    await WeatherMonitorService.initialize();
    logger.info('✅ Сервис мониторинга погоды инициализирован');
    
    logger.info('🎉 Все сервисы успешно инициализированы');
  } catch (error) {
    logger.error('❌ Ошибка инициализации сервисов:', error);
    process.exit(1);
  }
}

/**
 * Настройка cron задач для мониторинга
 */
function setupCronJobs() {
  logger.info('Настройка cron задач...');
  
  // Мониторинг погоды каждые 10 минут
  cron.schedule('*/10 * * * *', async () => {
    try {
      logger.info('🔍 Запуск мониторинга погодных условий');
      await WeatherMonitorService.checkAllUsers();
    } catch (error) {
      logger.error('Ошибка мониторинга погоды:', error);
    }
  });
  
  // Очистка старых данных каждую ночь в 2:00
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('🧹 Очистка старых данных');
      await DatabaseService.cleanupOldData();
    } catch (error) {
      logger.error('Ошибка очистки данных:', error);
    }
  });
  
  // Проверка качества воздуха каждый час
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('🌬️ Проверка качества воздуха');
      await WeatherMonitorService.updateAirQualityData();
    } catch (error) {
      logger.error('Ошибка обновления данных о качестве воздуха:', error);
    }
  });
  
  logger.info('✅ Cron задачи настроены');
}

/**
 * Обработка сигналов завершения
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Получен сигнал ${signal}, начинаем корректное завершение...`);
    
    try {
      // Закрываем соединение с базой данных
      await DatabaseService.disconnect();
      logger.info('✅ Соединение с базой данных закрыто');
      
      // Останавливаем cron задачи
      cron.destroy();
      logger.info('✅ Cron задачи остановлены');
      
      logger.info('👋 Сервер корректно завершен');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Ошибка при завершении сервера:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Запуск сервера
 */
async function startServer() {
  try {
    // Инициализация сервисов
    await initializeServices();
    
    // Настройка cron задач
    setupCronJobs();
    
    // Настройка корректного завершения
    setupGracefulShutdown();
    
    // Запуск сервера
    const server = app.listen(PORT, () => {
      logger.info(`🌈 RainbowFinder Backend запущен на порту ${PORT}`);
      logger.info(`🔗 API доступен по адресу: http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    });
    
    // Обработка ошибок сервера
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Порт ${PORT} уже используется`);
      } else {
        logger.error('❌ Ошибка сервера:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('❌ Не удалось запустить сервер:', error);
    process.exit(1);
  }
}

// Запуск приложения
if (require.main === module) {
  startServer();
}

export default app; 