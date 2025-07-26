import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

// Импорт сервисов
import { WeatherService } from './services/WeatherService';
import { RainbowCalculator } from './services/RainbowCalculator';
import { SunCalculator } from './services/SunCalculator';
import { RainbowCompass } from './components/RainbowCompass';
import Logger from './utils/Logger';

const { width, height } = Dimensions.get('window');

// Настройка уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // Состояние приложения
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [rainbowData, setRainbowData] = useState(null);
  const [sunData, setSunData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Инициализация приложения
  useEffect(() => {
    initializeApp();
  }, []);

  // Автообновление каждые 5 минут
  useEffect(() => {
    const interval = setInterval(() => {
      if (location && permissionsGranted) {
        updateRainbowData(false);
      }
    }, 5 * 60 * 1000); // 5 минут

    return () => clearInterval(interval);
  }, [location, permissionsGranted]);

  /**
   * Инициализация приложения (УЛУЧШЕННАЯ)
   */
  const initializeApp = async () => {
    try {
      Logger.info('APP', '=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===');
      setLoading(true);
      
      // Шаг 1: Получаем разрешения
      const permissions = await requestPermissions();
      setPermissionsGranted(permissions);
      
      if (!permissions) {
        Logger.error('APP', 'Разрешения не получены - останавливаем инициализацию');
        return;
      }
      
      // Шаг 2: Получаем местоположение
      const currentLocation = await getCurrentLocation();
      if (!currentLocation) {
        Logger.error('APP', 'Не удалось получить местоположение');
        setPermissionsGranted(false);
        return;
      }
      
      Logger.success('APP', 'Местоположение получено успешно');
      setLocation(currentLocation);
      
      // Шаг 3: Получаем название места (не критично)
      try {
        const name = await WeatherService.getLocationName(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        const locationText = name ? `${name.city}, ${name.country}` : 'Неизвестное место';
        setLocationName(locationText);
        Logger.info('APP', 'Название места получено', { name: locationText });
      } catch (nameError) {
        Logger.warn('APP', 'Не удалось получить название места', nameError);
        setLocationName('Неизвестное место');
      }
      
      // Шаг 4: Загружаем данные о радуге (не критично)
      try {
        await updateRainbowData(false);
        Logger.success('APP', 'Данные о радуге загружены');
      } catch (dataError) {
        Logger.warn('APP', 'Не удалось загрузить данные о радуге', dataError);
        // Продолжаем работу без данных
      }
      
      Logger.success('APP', '=== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
      
    } catch (error) {
      Logger.error('APP', 'Критическая ошибка инициализации', error);
      setPermissionsGranted(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Запрос разрешений (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   */
  const requestPermissions = async () => {
    try {
      Logger.info('APP', 'Начинаем запрос разрешений...');
      
      // Проверяем текущие разрешения сначала
      const { status: currentLocationStatus } = await Location.getForegroundPermissionsAsync();
      Logger.info('APP', 'Текущий статус геолокации', { status: currentLocationStatus });
      
      if (currentLocationStatus === 'granted') {
        Logger.success('APP', 'Разрешение на геолокацию уже есть!');
        
        // Пытаемся получить уведомления (не критично)
        try {
          await Notifications.requestPermissionsAsync();
          Logger.info('APP', 'Уведомления запрошены');
        } catch (e) {
          Logger.warn('APP', 'Уведомления недоступны');
        }
        
        return true;
      }
      
      // Если разрешения нет - запрашиваем
      Logger.info('APP', 'Запрашиваем разрешение на геолокацию...');
      const { status: newLocationStatus } = await Location.requestForegroundPermissionsAsync();
      Logger.info('APP', 'Новый статус геолокации', { status: newLocationStatus });
      
      if (newLocationStatus === 'granted') {
        Logger.success('APP', 'Разрешение получено!');
        
        // Пытаемся получить уведомления
        try {
          await Notifications.requestPermissionsAsync();
        } catch (e) {
          // Игнорируем ошибки уведомлений
        }
        
        return true;
      } else {
        Logger.error('APP', 'Разрешение НЕ получено', { status: newLocationStatus });
        return false;
      }
      
    } catch (error) {
      Logger.error('APP', 'Ошибка запроса разрешений', error);
      return false;
    }
  };

  /**
   * Получение текущего местоположения (БЕЗОПАСНАЯ ВЕРСИЯ)
   */
  const getCurrentLocation = async () => {
    try {
      Logger.info('APP', 'Получаем местоположение...');
      
      // Проверяем разрешения еще раз
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Logger.error('APP', 'Нет разрешения на геолокацию');
        throw new Error('Нет разрешения на геолокацию');
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Понижаем точность для стабильности
        timeout: 15000, // Увеличиваем timeout
        mayShowUserSettingsDialog: false, // Не показываем диалоги
      });
      
      Logger.success('APP', 'Местоположение получено', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      return location;
    } catch (error) {
      Logger.error('APP', 'Ошибка получения местоположения', error);
      return null;
    }
  };

  /**
   * Обновление данных о радуге (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   */
  const updateRainbowData = async (showLoading = true) => {
    if (!location) {
      Alert.alert('Ошибка', 'Местоположение не определено. Проверьте разрешения на геолокацию.');
      return;
    }

    try {
      if (showLoading) setLoading(true);
      
      const { latitude, longitude } = location.coords;
      Logger.info('APP', 'Обновление данных для координат', { latitude, longitude });
      
      // 1. Получение погодных данных (с детальной обработкой ошибок)
      let currentWeather;
      try {
              Logger.info('APP', 'Начинаем получение погодных данных...', { latitude, longitude });
      currentWeather = await WeatherService.getCurrentWeather(latitude, longitude);
      setWeather(currentWeather);
      Logger.success('APP', 'Погодные данные получены успешно');
              } catch (weatherError) {
          Logger.error('APP', 'Ошибка получения погоды', weatherError);
          Logger.error('APP', 'Детали ошибки', { message: weatherError.message, stack: weatherError.stack });
        Alert.alert(
          'Ошибка погодных данных', 
          `Не удалось получить данные о погоде:\n${weatherError.message}\n\nПроверьте интернет-соединение.`,
          [
            { text: 'Попробовать снова', onPress: () => updateRainbowData(showLoading) },
            { text: 'Отмена', style: 'cancel' }
          ]
        );
        return;
      }
      
      // 2. Астрономические расчеты (с обработкой ошибок)
      let sunPosition, solarEvents;
      try {
        const currentTime = new Date();
        sunPosition = SunCalculator.calculateSunPosition(latitude, longitude, currentTime);
        solarEvents = SunCalculator.calculateSolarEvents(latitude, longitude, currentTime);
        setSunData({ position: sunPosition, events: solarEvents });
        Logger.success('APP', 'Астрономические расчеты выполнены успешно');
              } catch (sunError) {
          Logger.error('APP', 'Ошибка астрономических расчетов', sunError);
        Alert.alert('Ошибка', 'Ошибка в астрономических расчетах');
        return;
      }
      
            // 3. Расчет вероятности радуги (с обработкой ошибок)
      let rainbowResult;
      try {
        const rainbowConditions = {
          latitude,
          longitude,
          weather: currentWeather,
          dateTime: new Date()
        };
        
        rainbowResult = RainbowCalculator.calculateRainbowProbability(rainbowConditions);
        setRainbowData(rainbowResult);
        Logger.success('APP', 'Расчет радуги выполнен успешно', { probability: rainbowResult.probability });
              } catch (rainbowError) {
          Logger.error('APP', 'Ошибка расчета радуги', rainbowError);
        Alert.alert('Ошибка', 'Ошибка в расчете вероятности радуги');
        return;
      }
      
      // 4. Обновление времени последнего обновления
      setLastUpdate(new Date());
      
      // 5. Проверка условий для уведомления (не критично)
      try {
        if (rainbowResult && rainbowResult.probability !== undefined) {
          await checkNotificationConditions(rainbowResult);
        }
              } catch (notificationError) {
          Logger.warn('APP', 'Ошибка уведомлений (не критично)', notificationError);
        // Не показываем ошибку пользователю, так как это не критично
      }
      
      Logger.success('APP', 'Обновление данных завершено успешно');
      
    } catch (error) {
      Logger.error('APP', 'Общая ошибка обновления данных', error);
      Alert.alert(
        'Ошибка обновления', 
        `Произошла ошибка при обновлении данных: ${error.message || 'Неизвестная ошибка'}`,
        [
          { text: 'Попробовать снова', onPress: () => updateRainbowData(showLoading) },
          { text: 'Отмена', style: 'cancel' }
        ]
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  /**
   * Проверка условий для отправки уведомления (УЛУЧШЕННАЯ)
   */
  const checkNotificationConditions = async (rainbowResult) => {
    const prob = rainbowResult.probability;
    
    if (prob > 80) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌈 СУПЕР условия для радуги!',
          body: `Вероятность ${prob}%! Был дождь + сейчас солнце! Направление: ${Math.round(rainbowResult.direction?.center || 0)}°`,
          data: { rainbowData: rainbowResult },
        },
        trigger: { seconds: 1 },
      });
    } else if (prob > 60) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌈 Отличные условия для радуги!',
          body: `Вероятность ${prob}%. Смотрите в направлении ${Math.round(rainbowResult.direction?.center || 0)}°`,
          data: { rainbowData: rainbowResult },
        },
        trigger: { seconds: 1 },
      });
    } else if (prob > 40) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌈 Возможна радуга',
          body: `Вероятность ${prob}%. Следите за небом!`,
          data: { rainbowData: rainbowResult },
        },
        trigger: { seconds: 1 },
      });
    }
  };

  /**
   * Обработчик обновления
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await updateRainbowData(false);
    setRefreshing(false);
  }, [location]);

  /**
   * Форматирование времени
   */
  const formatTime = (date) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  /**
   * Получение цвета вероятности
   */
  const getProbabilityColor = (probability) => {
    if (probability >= 70) return '#10b981'; // Зеленый
    if (probability >= 50) return '#f59e0b'; // Желтый
    if (probability >= 30) return '#ef4444'; // Красный
    return '#6b7280'; // Серый
  };

  /**
   * Получение описания качества
   */
  const getQualityDescription = (quality) => {
    const descriptions = {
      none: 'Радуга невозможна',
      very_weak: 'Очень слабая радуга',
      weak: 'Слабая радуга',
      moderate: 'Умеренная радуга',
      good: 'Хорошая радуга',
      excellent: 'Превосходная радуга!'
    };
    return descriptions[quality] || 'Неизвестно';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Инициализация RainbowFinder...</Text>
          <Text style={styles.loadingSubtext}>
            Получение местоположения и погодных данных
          </Text>
        </View>
        <StatusBar style="light" />
      </LinearGradient>
    );
  }

  if (!permissionsGranted) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={80} color="white" />
          <Text style={styles.errorTitle}>Разрешения для RainbowFinder</Text>
          <Text style={styles.errorText}>
            🌈 Для поиска радуги нужен доступ к вашему местоположению{'\n\n'}
            📍 Это необходимо для точных астрономических расчетов{'\n\n'}
            🔔 Уведомления помогут не пропустить радугу
          </Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
            <Ionicons name="refresh-outline" size={24} color="white" />
            <Text style={styles.retryButtonText}>Повторить попытку</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.retryButton, styles.settingsButton]} 
            onPress={() => {
              Alert.alert(
                'Как дать разрешения',
                '1. Нажмите "Настройки"\n2. Найдите "RainbowFinder"\n3. Включите "Местоположение"\n4. Вернитесь в приложение\n5. Нажмите "Повторить попытку"',
                [
                  { text: 'Понятно', style: 'default' },
                  { text: 'Настройки', onPress: () => {
                    // На Android можно попробовать открыть настройки
                    console.log('Открытие настроек...');
                  }}
                ]
              );
            }}
          >
            <Ionicons name="settings-outline" size={24} color="white" />
            <Text style={styles.retryButtonText}>Помощь с настройками</Text>
          </TouchableOpacity>
          
          <Text style={styles.permissionNote}>
            💡 Без геолокации мы не сможем рассчитать{'\n'}
            положение солнца и направление радуги
          </Text>
        </View>
        <StatusBar style="light" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
            colors={['white']}
          />
        }
      >
        {/* Заголовок */}
        <View style={styles.header}>
          <Text style={styles.title}>🌈 RainbowFinder</Text>
          <Text style={styles.location}>{locationName}</Text>
          {lastUpdate && (
            <Text style={styles.lastUpdate}>
              Обновлено: {formatTime(lastUpdate)}
            </Text>
          )}
        </View>

        {/* Основная карточка вероятности */}
        {rainbowData && (
          <View style={styles.mainCard}>
            <View style={styles.probabilityContainer}>
              <Text style={styles.probabilityLabel}>Вероятность радуги</Text>
              <Text 
                style={[
                  styles.probabilityValue,
                  { color: getProbabilityColor(rainbowData.probability) }
                ]}
              >
                {rainbowData.probability.toFixed(1)}%
              </Text>
              <Text style={styles.qualityText}>
                {getQualityDescription(rainbowData.quality)}
              </Text>
            </View>
            
            {rainbowData.probability > 30 && (
              <View style={styles.directionContainer}>
                <Ionicons name="compass-outline" size={24} color="#374151" />
                <Text style={styles.directionText}>
                  Направление: {Math.round(rainbowData.direction.center)}°
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Точный компас со стрелочкой (ВСЕГДА ПОКАЗЫВАТЬ ДЛЯ ТЕСТИРОВАНИЯ) */}
        <RainbowCompass
          rainbowDirection={rainbowData?.direction}
          probability={rainbowData?.probability || 0}
          sunPosition={sunData?.position}
          userLocation={location}
        />

        {/* Условия */}
        {rainbowData && (
          <View style={styles.conditionsCard}>
            <Text style={styles.cardTitle}>🔬 Научный анализ</Text>
            
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>☀️ Угол солнца:</Text>
              <Text style={styles.conditionValue}>
                {sunData?.position.altitude.toFixed(1)}° 
                {sunData?.position.altitude > 0 && sunData?.position.altitude < 42 ? ' ✅' : ' ❌'}
              </Text>
            </View>
            
            {/* НОВЫЙ: Недавние осадки */}
            {weather?.recentRain && (
              <View style={styles.conditionRow}>
                <Text style={styles.conditionLabel}>🌧️ Недавний дождь:</Text>
                <Text style={styles.conditionValue}>
                  {weather.recentRain.isOptimal ? '✅ ИДЕАЛЬНО!' : 
                   weather.recentRain.hasRecentRain ? '⚠️ Был' : '❌ Не было'}
                </Text>
              </View>
            )}
            
            {/* НОВЫЙ: Текущий солнечный свет */}
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>☀️ Солнечный свет:</Text>
              <Text style={styles.conditionValue}>
                {weather?.weather[0].description.includes('ясно') || 
                 weather?.weather[0].description.includes('солнечно') ? '✅ Светит' : 
                 weather?.clouds.all < 50 ? '🌤️ Частично' : '☁️ Закрыто'}
              </Text>
            </View>
            
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>💧 Влажность:</Text>
              <Text style={styles.conditionValue}>
                {weather?.humidity}%
                {weather?.humidity > 70 ? ' ✅' : ' ❌'}
              </Text>
            </View>
            
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>☁️ Облачность:</Text>
              <Text style={styles.conditionValue}>
                {weather?.clouds.all}%
                {weather?.clouds.all > 20 && weather?.clouds.all < 80 ? ' ✅' : ' ❌'}
              </Text>
            </View>
            
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>👁️ Видимость:</Text>
              <Text style={styles.conditionValue}>
                {weather?.visibility ? (weather.visibility / 1000).toFixed(1) : '--'}км
                {weather?.visibility > 5000 ? ' ✅' : ' ❌'}
              </Text>
            </View>
            
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>🌡️ Температура:</Text>
              <Text style={styles.conditionValue}>
                {weather?.temperature.toFixed(1)}°C
              </Text>
            </View>
          </View>
        )}

        {/* НОВАЯ КАРТОЧКА: Детальный анализ недавних осадков */}
        {weather?.recentRain && weather.recentRain.hasRecentRain && (
          <View style={styles.recentRainCard}>
            <Text style={styles.cardTitle}>🌧️ Анализ недавних осадков</Text>
            <Text style={styles.recentRainDescription}>
              {weather.recentRain.description}
            </Text>
            {weather.recentRain.timeSinceRain !== null && (
              <Text style={styles.recentRainTime}>
                ⏰ {weather.recentRain.timeSinceRain < 1 ? 
                  `${Math.round(weather.recentRain.timeSinceRain * 60)} минут назад` :
                  `${weather.recentRain.timeSinceRain.toFixed(1)} часов назад`}
              </Text>
            )}
          </View>
        )}

        {/* Солнечные события */}
        {sunData && (
          <View style={styles.solarCard}>
            <Text style={styles.cardTitle}>🌅 Солнечные события</Text>
            
            <View style={styles.solarEventsContainer}>
              <View style={styles.solarEvent}>
                <Text style={styles.solarEventLabel}>Восход</Text>
                <Text style={styles.solarEventTime}>
                  {formatTime(sunData.events.sunrise)}
                </Text>
              </View>
              
              <View style={styles.solarEvent}>
                <Text style={styles.solarEventLabel}>Закат</Text>
                <Text style={styles.solarEventTime}>
                  {formatTime(sunData.events.sunset)}
                </Text>
              </View>
              
              <View style={styles.solarEvent}>
                <Text style={styles.solarEventLabel}>Солн. полдень</Text>
                <Text style={styles.solarEventTime}>
                  {formatTime(sunData.events.solarNoon)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Рекомендации */}
        {rainbowData?.recommendations && rainbowData.recommendations.length > 0 && (
          <View style={styles.recommendationsCard}>
            <Text style={styles.cardTitle}>💡 Рекомендации</Text>
            {rainbowData.recommendations.map((recommendation, index) => (
              <Text key={index} style={styles.recommendationText}>
                • {recommendation}
              </Text>
            ))}
          </View>
        )}

        {/* Кнопка обновления */}
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => updateRainbowData(true)}
          disabled={loading}
        >
          <Ionicons name="refresh-outline" size={24} color="white" />
          <Text style={styles.refreshButtonText}>Обновить данные</Text>
        </TouchableOpacity>

        {/* Информация о приложении */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>О приложении</Text>
          <Text style={styles.infoText}>
            RainbowFinder использует точные астрономические расчеты и метеорологические данные 
            для определения вероятности появления радуги. Основано на физических законах оптики 
            и угле Декарта (42°).
          </Text>
        </View>
      </ScrollView>
      
      <StatusBar style="light" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  settingsButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
  },
  permissionNote: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  location: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 5,
  },
  lastUpdate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
  },
  mainCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  probabilityContainer: {
    alignItems: 'center',
  },
  probabilityLabel: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 10,
  },
  probabilityValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  qualityText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '500',
  },
  directionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
  },
  directionText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 10,
    fontWeight: '500',
  },
  conditionsCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 15,
  },
  conditionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  conditionLabel: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
  },
  conditionValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  solarCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  solarEventsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  solarEvent: {
    alignItems: 'center',
    flex: 1,
  },
  solarEventLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 5,
  },
  solarEventTime: {
    fontSize: 16,
    color: '#374151',
    fontWeight: 'bold',
  },
  recommendationsCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recommendationText: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  refreshButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  recentRainCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  recentRainDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 10,
    fontWeight: '500',
  },
  recentRainTime: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
}); 