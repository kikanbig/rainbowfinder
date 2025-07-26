/**
 * 📱 Сервис Push-уведомлений
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Logger } from '../utils/Logger';

class NotificationService {
  constructor() {
    this.pushToken = null;
    // 🚀 ОБНОВИТЕ ЭТОТ URL ПОСЛЕ ДЕПЛОЯ НА RAILWAY!
    this.backendUrl = 'https://your-railway-app.railway.app';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) return this.pushToken;

      Logger.info('NOTIFICATIONS', 'Инициализация уведомлений...');
      
      this.setupNotificationHandler();
      await this.registerForPushNotifications();
      
      if (this.pushToken) {
        await this.sendTokenToBackend();
      }

      this.isInitialized = true;
      return this.pushToken;
    } catch (error) {
      Logger.error('NOTIFICATIONS', 'Ошибка инициализации', error);
      throw error;
    }
  }

  setupNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  async registerForPushNotifications() {
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    this.pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    
    return this.pushToken;
  }

  async sendTokenToBackend() {
    if (!this.pushToken) return;

    try {
      await fetch(`${this.backendUrl}/api/notifications/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushToken: this.pushToken,
          deviceInfo: { platform: Platform.OS },
          preferences: { minProbability: 80 }
        }),
      });
    } catch (error) {
      Logger.error('NOTIFICATIONS', 'Ошибка отправки токена', error);
    }
  }

  async updateUserLocation(latitude, longitude, locationName) {
    if (!this.pushToken) return;

    try {
      await fetch(`${this.backendUrl}/api/notifications/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushToken: this.pushToken,
          location: { latitude, longitude, name: locationName }
        }),
      });
    } catch (error) {
      Logger.error('NOTIFICATIONS', 'Ошибка обновления локации', error);
    }
  }
}

export const notificationService = new NotificationService();