# RainbowFinder Backend Dockerfile

# Используем официальный Node.js образ
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем исходный код
COPY . .

# Сборка TypeScript
RUN npm run build

# Производственный образ
FROM node:18-alpine AS production

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S rainbow-finder -u 1001

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем собранное приложение
COPY --from=builder --chown=rainbow-finder:nodejs /app/dist ./dist

# Создаем директории для логов
RUN mkdir -p /app/logs && chown rainbow-finder:nodejs /app/logs

# Переключаемся на непривилегированного пользователя
USER rainbow-finder

# Открываем порт
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Запускаем приложение
CMD ["npm", "start"] 