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
   * Инициализация приложения
   */
  const initializeApp = async () => {
    try {
      setLoading(true);
      
      // Запрос разрешений
      const permissions = await requestPermissions();
      setPermissionsGranted(permissions);
      
      if (permissions) {
        // Получение местоположения
        const currentLocation = await getCurrentLocation();
        if (currentLocation) {
          setLocation(currentLocation);
          
          // Получение названия места
          const name = await WeatherService.getLocationName(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude
          );
          setLocationName(name ? `${name.city}, ${name.country}` : 'Неизвестное место');
          
          // Обновление данных о радуге
          await updateRainbowData(false);
        }
      }
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      Alert.alert('Ошибка', 'Не удалось инициализировать приложение');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Запрос разрешений
   */
  const requestPermissions = async () => {
    try {
      // Разрешение на геолокацию
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert(
          'Разрешение на геолокацию',
          'Для работы приложения необходимо разрешение на доступ к местоположению'
        );
        return false;
      }

      // Разрешение на фоновую геолокацию
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      // Разрешение на уведомления
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      
      return true;
    } catch (error) {
      console.error('Ошибка запроса разрешений:', error);
      return false;
    }
  };

  /**
   * Получение текущего местоположения
   */
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });
      
      return location;
    } catch (error) {
      console.error('Ошибка получения местоположения:', error);
      Alert.alert('Ошибка', 'Не удалось определить местоположение');
      return null;
    }
  };

  /**
   * Обновление данных о радуге
   */
  const updateRainbowData = async (showLoading = true) => {
    if (!location) return;

    try {
      if (showLoading) setLoading(true);
      
      const { latitude, longitude } = location.coords;
      
      // Получение погодных данных
      const currentWeather = await WeatherService.getCurrentWeather(latitude, longitude);
      setWeather(currentWeather);
      
      // Астрономические расчеты
      const currentTime = new Date();
      const sunPosition = SunCalculator.calculateSunPosition(latitude, longitude, currentTime);
      const solarEvents = SunCalculator.calculateSolarEvents(latitude, longitude, currentTime);
      setSunData({ position: sunPosition, events: solarEvents });
      
      // Расчет вероятности радуги
      const rainbowConditions = {
        latitude,
        longitude,
        weather: currentWeather,
        dateTime: currentTime
      };
      
      const rainbowResult = RainbowCalculator.calculateRainbowProbability(rainbowConditions);
      setRainbowData(rainbowResult);
      
      // Обновление времени последнего обновления
      setLastUpdate(new Date());
      
      // Проверка условий для уведомления
      await checkNotificationConditions(rainbowResult);
      
    } catch (error) {
      console.error('Ошибка обновления данных:', error);
      Alert.alert('Ошибка', 'Не удалось обновить данные о радуге');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  /**
   * Проверка условий для отправки уведомления
   */
  const checkNotificationConditions = async (rainbowResult) => {
    if (rainbowResult.probability > 70) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌈 Отличные условия для радуги!',
          body: `Вероятность ${rainbowResult.probability}%. Смотрите в направлении ${Math.round(rainbowResult.direction.center)}°`,
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
          <Text style={styles.errorTitle}>Необходимы разрешения</Text>
          <Text style={styles.errorText}>
            Для работы приложения нужен доступ к геолокации и уведомлениям
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
            <Text style={styles.retryButtonText}>Попробовать снова</Text>
          </TouchableOpacity>
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

        {/* Точный компас со стрелочкой */}
        {rainbowData && sunData && (
          <RainbowCompass
            rainbowDirection={rainbowData.direction}
            probability={rainbowData.probability}
            sunPosition={sunData.position}
            userLocation={location}
          />
        )}

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
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
}); 