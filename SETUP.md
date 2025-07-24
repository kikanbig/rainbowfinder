# 🌈 RainbowFinder - Инструкция по установке

*Пошаговое руководство по настройке и запуску приложения для поиска радуги*

## 📋 Требования

### Системные требования
- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 или **yarn** >= 1.22.0
- **Expo CLI** (устанавливается глобально)
- **Git**

### Внешние сервисы
- **OpenWeatherMap API** (бесплатный аккаунт)
- **Expo.dev** аккаунт (для сборки APK)
- **Railway** аккаунт (для backend)

## 🛠️ Установка

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd Rainbow
```

### 2. Установка глобальных зависимостей

```bash
# Установка Expo CLI
npm install -g @expo/cli

# Установка Railway CLI (опционально)
npm install -g @railway/cli
```

## 🔧 Настройка Backend

### 1. Переход в директорию backend

```bash
cd backend
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

```bash
# Копируем пример конфигурации
cp config.example.env .env

# Редактируем .env файл
nano .env
```

**Важные переменные для настройки:**

```env
# OpenWeatherMap API ключ (обязательно!)
OPENWEATHER_API_KEY=your_api_key_here

# JWT секрет (обязательно!)
JWT_SECRET=your_super_secret_key_here

# Expo токен для push уведомлений
EXPO_ACCESS_TOKEN=your_expo_token_here

# Порт сервера
PORT=3000
```

### 4. Получение OpenWeatherMap API ключа

1. Перейдите на [OpenWeatherMap](https://openweathermap.org/api)
2. Создайте бесплатный аккаунт
3. В разделе "API keys" создайте новый ключ
4. Скопируйте ключ в переменную `OPENWEATHER_API_KEY`

### 5. Запуск backend в режиме разработки

```bash
npm run dev
```

Backend будет доступен по адресу: `http://localhost:3000`

## 📱 Настройка Mobile App

### 1. Переход в директорию mobile-app

```bash
cd ../mobile-app
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Создайте файл `.env.local`:

```bash
nano .env.local
```

Добавьте переменные:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_OPENWEATHER_API_KEY=your_api_key_here
```

### 4. Запуск приложения

```bash
# Запуск в режиме разработки
expo start

# Для Android эмулятора
expo start --android

# Для iOS симулятора (только на macOS)
expo start --ios
```

## 🚀 Деплой на Railway

### 1. Авторизация в Railway

```bash
railway login
```

### 2. Создание проекта

```bash
cd backend
railway init
```

### 3. Настройка переменных окружения

```bash
# Добавляем переменные через CLI
railway add OPENWEATHER_API_KEY=your_key_here
railway add JWT_SECRET=your_secret_here
railway add NODE_ENV=production

# Или через веб-интерфейс Railway
```

### 4. Деплой

```bash
railway up
```

### 5. Получение URL сервиса

```bash
railway domain
```

## 📦 Сборка APK

### 1. Настройка Expo проекта

```bash
cd mobile-app

# Обновляем URL API на production
nano .env.production
```

```env
EXPO_PUBLIC_API_URL=https://your-railway-app.railway.app/api
```

### 2. Настройка EAS Build

```bash
# Логинимся в Expo
expo login

# Настраиваем EAS
expo install @expo/cli
eas init
```

### 3. Сборка APK

```bash
# Сборка для Android
eas build --platform android --profile preview

# Ждем завершения сборки и скачиваем APK
```

## 🔧 Настройка уведомлений

### 1. Получение Expo Access Token

1. Перейдите на [expo.dev](https://expo.dev)
2. Войдите в аккаунт
3. Перейдите в настройки профиля
4. Создайте новый Access Token
5. Добавьте его в переменные окружения backend

### 2. Настройка push уведомлений в приложении

Push уведомления настроены автоматически через Expo Notifications.

## 🗄️ База данных (опционально)

По умолчанию приложение работает в памяти. Для production рекомендуется использовать MongoDB:

### 1. Настройка MongoDB Atlas

1. Создайте аккаунт на [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Создайте бесплатный кластер
3. Получите строку подключения
4. Добавьте в переменные окружения:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rainbow-finder
```

## 🧪 Тестирование

### Backend тесты

```bash
cd backend
npm test
```

### Mobile app тесты

```bash
cd mobile-app
npm test
```

## 📊 Мониторинг

### Проверка состояния backend

```bash
curl http://localhost:3000/health
```

### Логи приложения

```bash
# Логи Railway
railway logs

# Локальные логи
tail -f backend/logs/app.log
```

## 🔍 Возможные проблемы

### 1. Ошибка API ключа OpenWeather

```
Error: HTTP Error: 401 Unauthorized
```

**Решение:** Проверьте правильность API ключа и его активацию (может занять несколько часов).

### 2. Проблемы с геолокацией

```
Error: Location request failed due to unsatisfied device settings
```

**Решение:** Убедитесь, что разрешения на геолокацию предоставлены.

### 3. Ошибки сборки Expo

```
Error: Unable to resolve module
```

**Решение:** 
```bash
expo install --fix
npx expo install --check
```

### 4. Проблемы с Railway деплоем

```
Error: Build failed
```

**Решение:** Проверьте логи:
```bash
railway logs --deployment
```

## 🆘 Поддержка

Если возникли проблемы:

1. Проверьте логи приложения
2. Убедитесь, что все API ключи настроены правильно
3. Проверьте сетевое соединение
4. Убедитесь, что все зависимости установлены

## 🎯 Готово!

После выполнения всех шагов у вас будет:

- ✅ Backend сервис на Railway
- ✅ Мобильное приложение в Expo
- ✅ APK файл для установки
- ✅ Система push уведомлений
- ✅ Научно точный алгоритм поиска радуги

Приложение готово к поиску радуги! 🌈 