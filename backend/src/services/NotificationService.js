/**
 * 🔔 Сервис уведомлений (Бэкенд)
 */
const { Expo } = require('expo-server-sdk');

class NotificationService {
  constructor() {
    this.expo = new Expo();
    this.users = new Map();
  }

  async registerUser(userData) {
    const { pushToken, deviceInfo, preferences } = userData;
    
    if (!Expo.isExpoPushToken(pushToken)) {
      throw new Error('Недействительный push токен');
    }

    this.users.set(pushToken, {
      pushToken,
      deviceInfo,
      preferences: { minProbability: 80, ...preferences },
      location: null,
      registeredAt: new Date()
    });

    console.log(`📱 Пользователь зарегистрирован: ${pushToken.substring(0, 20)}...`);
    return { success: true };
  }

  async updateUserLocation(pushToken, location) {
    const user = this.users.get(pushToken);
    if (!user) throw new Error('Пользователь не найден');

    user.location = location;
    return { success: true };
  }

  async sendRainbowAlert(location, probability) {
    const messages = [];
    
    for (const [pushToken, user] of this.users) {
      if (probability >= user.preferences.minProbability && user.location) {
        messages.push({
          to: pushToken,
          title: '🌈 Радуга возможна!',
          body: `Вероятность ${probability}% в ${location.name}!`,
          data: { type: 'rainbow_alert', probability }
        });
      }
    }

    if (messages.length > 0) {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
      console.log(`✅ Отправлено ${messages.length} уведомлений`);
    }

    return { sent: messages.length };
  }
}

module.exports = { NotificationService: new NotificationService() };
