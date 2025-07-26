# 🌈 Kate's Rainbow Backend

Бэкенд для системы уведомлений о радуге.

## 🚀 Деплой на Railway

1. **Зарегистрируйтесь на Railway.app**
2. **Подключите GitHub репозиторий**
3. **Выберите папку backend для деплоя**
4. **Добавьте переменные окружения:**
   - `OPENWEATHER_API_KEY` - ваш API ключ OpenWeatherMap

## 📱 Настройка мобильного приложения

После деплоя обновите URL в `NotificationService.js`:
```javascript
this.backendUrl = 'https://your-railway-app.railway.app';
```

## 🔄 Как работает

- ⏰ **Каждые 5 минут** проверяются условия для радуги
- 📱 **Push уведомления** отправляются при вероятности 80%+
- 🌍 **Группировка по локациям** для экономии API вызовов
- 📊 **Лимит 900 API вызовов/день** (безопасно в пределах 1000)

## 🔧 API Endpoints

- `POST /api/notifications/register` - регистрация push токена
- `POST /api/notifications/update-location` - обновление локации
- `GET /api/notifications/stats` - статистика
- `GET /health` - проверка здоровья сервиса
