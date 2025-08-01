import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { notificationService } from './services/NotificationService';
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

// 🚨 ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК (ОТКЛЮЧЕН ДЛЯ СТАБИЛЬНОСТИ)
// if (__DEV__) {
//   const originalConsoleError = console.error;
//   console.error = (...args) => {
//     Logger.error('GLOBAL', 'Необработанная ошибка:', ...args);
//     originalConsoleError.apply(console, args);
//   };
// }

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
  const [initializationError, setInitializationError] = useState(null);
  // const [appError, setAppError] = useState(null); // 🚨 Обработка ошибок приложения (ОТКЛЮЧЕНО)

  // Ref для отслеживания состояния компонента
  const isMountedRef = useRef(true);
  const updateInProgressRef = useRef(false);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Инициализация приложения
  useEffect(() => {
    initializeApp();
  }, []);

  // Автообновление каждые 5 минут
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMountedRef.current && location && permissionsGranted && !updateInProgressRef.current) {
        updateRainbowData(false);
      }
    }, 5 * 60 * 1000); // 5 минут

    return () => clearInterval(interval);
  }, [location, permissionsGranted]);

  /**
   * Безопасное обновление состояния (только если компонент смонтирован)
   */
  const safeSetState = useCallback((setter, value) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  /**
   * Инициализация приложения (УЛУЧШЕННАЯ)
   */
  const initializeApp = async () => {
    try {
      Logger.info('APP', '=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===');
      setLoading(true);
      
      // Шаг 1: Получаем разрешения
      Logger.info('APP', 'Запрашиваем разрешения...');
      const permissions = await requestPermissions();
      Logger.info('APP', `Разрешения получены: ${permissions}`);
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
        
        // 📱 Обновляем локацию в сервисе уведомлений
        try {
          await notificationService.updateUserLocation(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude,
            locationText
          );
          Logger.success('APP', 'Локация обновлена в сервисе уведомлений');
        } catch (notifError) {
          Logger.warn('APP', 'Не удалось обновить локацию в сервисе уведомлений', notifError);
        }
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
        
        // 📱 Инициализируем новый сервис уведомлений
        try {
          await notificationService.initialize();
          Logger.success('APP', 'Сервис уведомлений инициализирован');
        } catch (e) {
          Logger.warn('APP', 'Уведомления недоступны', e);
        }
        
        return true;
      }
      
      // Если разрешения нет - запрашиваем
      Logger.info('APP', 'Запрашиваем разрешение на геолокацию...');
      const { status: newLocationStatus } = await Location.requestForegroundPermissionsAsync();
      Logger.info('APP', 'Новый статус геолокации', { status: newLocationStatus });
      
      if (newLocationStatus === 'granted') {
        Logger.success('APP', 'Разрешение получено!');
        
        // 📱 Инициализируем новый сервис уведомлений
        try {
          await notificationService.initialize();
          Logger.success('APP', 'Сервис уведомлений инициализирован');
        } catch (e) {
          Logger.warn('APP', 'Уведомления недоступны', e);
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
    if (!isMountedRef.current || updateInProgressRef.current) {
      Logger.info('APP', 'Обновление пропущено: компонент размонтирован или обновление уже идет');
      return;
    }

    if (!location) {
      Alert.alert('Ошибка', 'Местоположение не определено. Проверьте разрешения на геолокацию.');
      return;
    }

    updateInProgressRef.current = true;

    try {
      if (showLoading && isMountedRef.current) safeSetState(setLoading, true);
      
      const { latitude, longitude } = location.coords;
      Logger.info('APP', 'Обновление данных для координат', { latitude, longitude });
      
      // 1. Получение погодных данных (с детальной обработкой ошибок)
      let currentWeather;
      try {
        Logger.info('APP', 'Начинаем получение погодных данных...', { latitude, longitude });
        currentWeather = await WeatherService.getCurrentWeather(latitude, longitude);
        
        if (!isMountedRef.current) return;
        
        safeSetState(setWeather, currentWeather);
        Logger.success('APP', 'Погодные данные получены успешно');
      } catch (weatherError) {
        Logger.error('APP', 'Ошибка получения погоды', weatherError);
        
        if (isMountedRef.current) {
          Alert.alert(
            'Ошибка погодных данных', 
            `Не удалось получить данные о погоде:\n${weatherError.message}\n\nПроверьте интернет-соединение.`,
            [
              { text: 'Попробовать снова', onPress: () => updateRainbowData(showLoading) },
              { text: 'Отмена', style: 'cancel' }
            ]
          );
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      
      // 2. Астрономические расчеты (с обработкой ошибок)
      let sunPosition, solarEvents;
      try {
        const currentTime = new Date();
        sunPosition = SunCalculator.calculateSunPosition(latitude, longitude, currentTime);
        solarEvents = SunCalculator.calculateSolarEvents(latitude, longitude, currentTime);
        
        if (!isMountedRef.current) return;
        
        safeSetState(setSunData, { position: sunPosition, events: solarEvents });
        Logger.success('APP', 'Астрономические расчеты выполнены успешно');
      } catch (sunError) {
        Logger.error('APP', 'Ошибка астрономических расчетов', sunError);
        
        if (isMountedRef.current) {
          Alert.alert('Ошибка', 'Ошибка в астрономических расчетах');
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      
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
        
        if (!isMountedRef.current) return;
        
        safeSetState(setRainbowData, rainbowResult);
        Logger.success('APP', 'Расчет радуги выполнен успешно', { probability: rainbowResult.probability });
      } catch (rainbowError) {
        Logger.error('APP', 'Ошибка расчета радуги', rainbowError);
        
        if (isMountedRef.current) {
          Alert.alert('Ошибка', 'Ошибка в расчете вероятности радуги');
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      
      // 4. Обновление времени последнего обновления
      safeSetState(setLastUpdate, new Date());
      
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
      
      if (isMountedRef.current) {
        Alert.alert(
          'Ошибка обновления', 
          `Произошла ошибка при обновлении данных: ${error.message || 'Неизвестная ошибка'}`,
          [
            { text: 'Попробовать снова', onPress: () => updateRainbowData(showLoading) },
            { text: 'Отмена', style: 'cancel' }
          ]
        );
      }
    } finally {
      updateInProgressRef.current = false;
      if (showLoading && isMountedRef.current) {
        safeSetState(setLoading, false);
      }
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
    if (!isMountedRef.current || updateInProgressRef.current) return;
    
    safeSetState(setRefreshing, true);
    await updateRainbowData(false);
    safeSetState(setRefreshing, false);
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
   * Получение градиента для вероятности
   */
  const getProbabilityGradient = (probability) => {
    if (probability >= 80) return ['#EDEAB1', '#FFE156', '#F0E68C']; // Celestial Yellow - волшебная радуга
    if (probability >= 60) return ['#FF654F', '#FF7F50', '#FF8C69']; // Neon Flare - яркая радуга
    if (probability >= 40) return ['#71ADBA', '#87CEEB', '#B0E0E6']; // Retro Blue - умеренная радуга
    if (probability >= 20) return ['#DDA0DD', '#D8BFD8', '#E6E6FA']; // Мягкие фиолетовые - слабая радуга
    return ['#4C5578', '#6A7B8A', '#8A9BA8']; // Future Dusk - радуга пока не видна
  };

  /**
   * Получение описания качества
   */
  const getQualityDescription = (quality) => {
    const descriptions = {
      none: 'Радуга пока не видна',
      very_weak: 'Слабые признаки радуги',
      weak: 'Едва заметная радуга',
      moderate: 'Умеренная радуга',
      good: 'Яркая радуга',
      excellent: 'Волшебная радуга!'
    };
    return descriptions[quality] || 'Ожидаем радугу';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#4C5578', '#71ADBA']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Инициализация Kate's Rainbow...</Text>
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
      <LinearGradient colors={['#4C5578', '#71ADBA']} style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={80} color="white" />
          <Text style={styles.errorTitle}>Разрешения для Kate's Rainbow</Text>
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
                '1. Нажмите "Настройки"\n2. Найдите "Kate\'s Rainbow"\n3. Включите "Местоположение"\n4. Вернитесь в приложение\n5. Нажмите "Повторить попытку"',
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

  // 🚨 ОТОБРАЖЕНИЕ ОШИБОК ПРИЛОЖЕНИЯ (ОТКЛЮЧЕНО ДЛЯ СТАБИЛЬНОСТИ)
  // if (appError) {
  //   return (
  //     <LinearGradient colors={['#4C5578', '#71ADBA']} style={styles.container}>
  //       <View style={styles.errorContainer}>
  //         <Ionicons name="warning-outline" size={80} color="white" />
  //         <Text style={styles.errorTitle}>Ошибка приложения</Text>
  //         <Text style={styles.errorText}>
  //           {appError}{'\n\n'}
  //           Попробуйте перезапустить приложение
  //         </Text>
  //         
  //         <TouchableOpacity style={styles.retryButton} onPress={() => {
  //           setAppError(null);
  //           initializeApp();
  //         }}>
  //           <Ionicons name="refresh-outline" size={24} color="white" />
  //           <Text style={styles.retryButtonText}>Перезапустить</Text>
  //         </TouchableOpacity>
  //       </View>
  //       <StatusBar style="light" />
  //     </LinearGradient>
  //   );
  // }

  return (
    <LinearGradient colors={['#4C5578', '#71ADBA']} style={styles.container}>
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
          <View style={styles.titleContainer}>
            <Text style={styles.titleEmoji}>🌈</Text>
            <Text style={styles.title}>Kate's Rainbow</Text>
          </View>
          
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.location}>{locationName}</Text>
          </View>
          
          {lastUpdate && (
            <Text style={styles.lastUpdate}>
              Обновлено: {formatTime(lastUpdate)}
            </Text>
          )}
        </View>

        {/* Основная карточка вероятности */}
        {rainbowData && (
          <View style={styles.mainCard}>
            <LinearGradient
              colors={getProbabilityGradient(rainbowData.probability)}
              style={styles.probabilityGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.probabilityContainer}>
                <Text style={styles.probabilityLabel}>Вероятность радуги</Text>
                
                <View style={styles.probabilityValueContainer}>
                  <Text style={styles.probabilityValue}>
                    {rainbowData.probability.toFixed(1)}%
                  </Text>
                </View>
                
                <Text style={styles.qualityText}>
                  {getQualityDescription(rainbowData.quality)}
                </Text>
                
                {rainbowData.probability > 30 && (
                  <View style={styles.directionContainer}>
                    <Ionicons name="compass-outline" size={24} color="white" />
                    <Text style={styles.directionText}>
                      {Math.round(rainbowData.direction.center)}° от севера
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Точный компас со стрелочкой (ВСЕГДА ПОКАЗЫВАТЬ ДЛЯ ТЕСТИРОВАНИЯ) */}
        <RainbowCompass
          rainbowDirection={rainbowData?.direction}
          probability={rainbowData?.probability || 0}
          sunPosition={sunData?.position}
          userLocation={location}
        />

        {/* Современный научный анализ */}
        {rainbowData && (
          <View style={styles.modernAnalysisContainer}>
            <Text style={styles.modernAnalysisTitle}>
              <Ionicons name="flask-outline" size={22} color="#40e0d0" /> Научный анализ
            </Text>
            
            <View style={styles.modernCardsRow}>
              {/* Карточка угла солнца */}
              <View style={styles.modernCard}>
                <LinearGradient
                  colors={sunData?.position.altitude > 0 && sunData?.position.altitude < 42 
                    ? ['#EDEAB1', '#FFE156'] 
                    : ['#FF654F', '#FF8C69']}
                  style={styles.modernCardGradient}
                >
                  <Text style={styles.modernCardIcon}>☀️</Text>
                  <Text style={styles.modernCardValue}>
                    {sunData?.position.altitude.toFixed(1)}°
                  </Text>
                  <Text style={styles.modernCardLabel}>Угол солнца</Text>
                  <View style={[
                    styles.modernCardStatus,
                    { backgroundColor: sunData?.position.altitude > 0 && sunData?.position.altitude < 42 ? '#ffffff' : '#fff5f5' }
                  ]}>
                    <Text style={[
                      styles.modernCardStatusText,
                      { color: sunData?.position.altitude > 0 && sunData?.position.altitude < 42 ? '#4C5578' : '#FF654F' }
                    ]}>
                      {sunData?.position.altitude > 0 && sunData?.position.altitude < 42 ? 'Отлично' : 'Не подходит'}
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Карточка влажности */}
              <View style={styles.modernCard}>
                <LinearGradient
                  colors={weather?.main?.humidity > 70 
                    ? ['#71ADBA', '#87CEEB'] 
                    : ['#FF654F', '#FF8C69']}
                  style={styles.modernCardGradient}
                >
                  <Text style={styles.modernCardIcon}>💧</Text>
                  <Text style={styles.modernCardValue}>
                    {weather?.main?.humidity}%
                  </Text>
                  <Text style={styles.modernCardLabel}>Влажность</Text>
                  <View style={[
                    styles.modernCardStatus,
                    { backgroundColor: weather?.main?.humidity > 70 ? '#ffffff' : '#fff5f5' }
                  ]}>
                    <Text style={[
                      styles.modernCardStatusText,
                      { color: weather?.main?.humidity > 70 ? '#4C5578' : '#FF654F' }
                    ]}>
                      {weather?.main?.humidity > 70 ? 'Отлично' : 'Низкая'}
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            </View>

            <View style={styles.modernCardsRow}>
              {/* Карточка облачности */}
              <View style={styles.modernCard}>
                <LinearGradient
                  colors={weather?.clouds?.all > 20 && weather?.clouds?.all < 80 
                    ? ['#DDA0DD', '#D8BFD8'] 
                    : ['#FF654F', '#FF8C69']}
                  style={styles.modernCardGradient}
                >
                  <Text style={styles.modernCardIcon}>☁️</Text>
                  <Text style={styles.modernCardValue}>
                    {weather?.clouds?.all}%
                  </Text>
                  <Text style={styles.modernCardLabel}>Облачность</Text>
                  <View style={[
                    styles.modernCardStatus,
                    { backgroundColor: weather?.clouds?.all > 20 && weather?.clouds?.all < 80 ? '#ffffff' : '#fff5f5' }
                  ]}>
                    <Text style={[
                      styles.modernCardStatusText,
                      { color: weather?.clouds?.all > 20 && weather?.clouds?.all < 80 ? '#4C5578' : '#FF654F' }
                    ]}>
                      {weather?.clouds?.all > 20 && weather?.clouds?.all < 80 ? 'Идеально' : 'Не подходит'}
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Карточка видимости */}
              <View style={styles.modernCard}>
                <LinearGradient
                  colors={weather?.visibility > 5000 
                    ? ['#4C5578', '#6A7B8A'] 
                    : ['#FF654F', '#FF8C69']}
                  style={styles.modernCardGradient}
                >
                  <Text style={styles.modernCardIcon}>👁️</Text>
                  <Text style={styles.modernCardValue}>
                    {weather?.visibility ? (weather.visibility / 1000).toFixed(1) : '--'}км
                  </Text>
                  <Text style={styles.modernCardLabel}>Видимость</Text>
                  <View style={[
                    styles.modernCardStatus,
                    { backgroundColor: weather?.visibility > 5000 ? '#ffffff' : '#fff5f5' }
                  ]}>
                    <Text style={[
                      styles.modernCardStatusText,
                      { color: weather?.visibility > 5000 ? '#4C5578' : '#FF654F' }
                    ]}>
                      {weather?.visibility > 5000 ? 'Отлично' : 'Плохая'}
                    </Text>
                  </View>
                </LinearGradient>
              </View>
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
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
              style={styles.cardContent}
            >
              <Text style={styles.modernCardTitle}>
                <Ionicons name="sunny-outline" size={20} color="#ff7f50" /> Солнечные события
              </Text>
              
              <View style={styles.solarEventsContainer}>
                <View style={styles.solarEvent}>
                  <View style={styles.solarIcon}>
                    <Ionicons name="sunny-outline" size={32} color="#ffd700" />
                  </View>
                  <Text style={styles.solarEventLabel}>Восход</Text>
                  <Text style={styles.solarEventTime}>
                    {formatTime(sunData.events.sunrise)}
                  </Text>
                </View>
                
                <View style={styles.solarEvent}>
                  <View style={styles.solarIcon}>
                    <Ionicons name="sunny" size={32} color="#ff7f50" />
                  </View>
                  <Text style={styles.solarEventLabel}>Полдень</Text>
                  <Text style={styles.solarEventTime}>
                    {formatTime(sunData.events.solarNoon)}
                  </Text>
                </View>
                
                <View style={styles.solarEvent}>
                  <View style={styles.solarIcon}>
                    <Ionicons name="moon-outline" size={32} color="#dda0dd" />
                  </View>
                  <Text style={styles.solarEventLabel}>Закат</Text>
                  <Text style={styles.solarEventTime}>
                    {formatTime(sunData.events.sunset)}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Рекомендации */}
        {rainbowData?.recommendations && rainbowData.recommendations.length > 0 && (
          <View style={styles.recommendationsCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
              style={styles.cardContent}
            >
              <Text style={styles.modernCardTitle}>
                <Ionicons name="bulb-outline" size={20} color="#dda0dd" /> Рекомендации
              </Text>
              
              {rainbowData.recommendations.map((recommendation, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={styles.recommendationBullet} />
                  <Text style={styles.recommendationText}>
                    {recommendation}
                  </Text>
                </View>
              ))}
            </LinearGradient>
          </View>
        )}

        {/* Кнопка обновления */}
        <TouchableOpacity 
          style={styles.modernRefreshButton} 
          onPress={() => updateRainbowData(true)}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FF654F', '#71ADBA']}
            style={styles.refreshButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="refresh-outline" size={24} color="white" />
            <Text style={styles.refreshButtonText}>Обновить данные</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* О приложении */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)']}
            style={styles.cardContent}
          >
            <Text style={styles.modernCardTitle}>
              <Ionicons name="heart" size={20} color="#FF654F" /> Для Кати с любовью
            </Text>
            
            <Text style={styles.infoText}>
              Катя, я очень тебя люблю. И сделал это приложение для того, чтобы ты видела чудеса.
            </Text>
            
            <View style={styles.infoFooter}>
              <Text style={styles.infoVersion}>Версия 2.0.0</Text>
              <Text style={styles.infoMadeWith}>Сделано с 💜</Text>
            </View>
          </LinearGradient>
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
  
  // Современные стили загрузки
  rainbowLoader: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  rainbowEmoji: {
    fontSize: 60,
  },
  loadingTitle: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loadingProgress: {
    width: '80%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 20,
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
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
    marginBottom: 35,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  titleEmoji: {
    fontSize: 36,
    marginRight: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
    letterSpacing: 0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  location: {
    fontSize: 16,
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  lastUpdate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mainCard: {
    borderRadius: 25,
    marginBottom: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 20,
  },
  probabilityGradient: {
    padding: 35,
  },
  probabilityContainer: {
    alignItems: 'center',
  },
  probabilityLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontWeight: '700',
    textAlign: 'center',
  },
  probabilityValueContainer: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 30,
    paddingHorizontal: 35,
    paddingVertical: 25,
    marginBottom: 20,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  probabilityValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 8,
  },
  qualityText: {
    fontSize: 22,
    color: 'white',
    fontWeight: '600',
    marginBottom: 25,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  directionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 20,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  directionText: {
    fontSize: 17,
    color: 'white',
    marginLeft: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  conditionsCard: {
    borderRadius: 25,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  blurBackground: {
    borderRadius: 25,
  },
  cardContent: {
    padding: 25,
    borderRadius: 25,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginLeft: 12,
  },
  modernCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4C5578', // Future Dusk - модный цвет 2025
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(76, 85, 120, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modernAnalysisContainer: {
    marginBottom: 25,
  },
  modernAnalysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  modernCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modernCard: {
    width: '48%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modernCardGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'space-between',
  },
  modernCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  modernCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 5,
  },
  modernCardLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modernCardStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modernCardStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  solarCard: {
    borderRadius: 25,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  solarEventsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  solarEvent: {
    alignItems: 'center',
    flex: 1,
    padding: 15,
  },
  solarIcon: {
    marginBottom: 12,
  },
  solarEventLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  solarEventTime: {
    fontSize: 18,
    color: '#374151',
    fontWeight: 'bold',
  },
  recommendationsCard: {
    borderRadius: 25,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  recommendationBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dda0dd',
    marginTop: 8,
    marginRight: 15,
    shadowColor: '#dda0dd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 2,
  },
  recommendationText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    flex: 1,
    fontWeight: '500',
  },
  modernRefreshButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  refreshButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 35,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  infoCard: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  infoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 114, 128, 0.2)',
  },
  infoVersion: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  infoMadeWith: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
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