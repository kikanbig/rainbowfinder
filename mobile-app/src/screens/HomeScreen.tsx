import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

// Services
import { WeatherService } from '../services/WeatherService';
import { RainbowCalculator } from '../services/RainbowCalculator';
import { SunCalculator } from '../services/SunCalculator';

// Components
import { RainbowMeter } from '../components/RainbowMeter';
import { WeatherCard } from '../components/WeatherCard';
import { SunInfoCard } from '../components/SunInfoCard';

const { width, height } = Dimensions.get('window');

interface RainbowConditions {
  probability: number;
  sunAngle: number;
  sunAzimuth: number;
  weather: any;
  rainbowDirection: number;
  isOptimal: boolean;
  nextOptimalTime?: Date;
}

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [rainbowConditions, setRainbowConditions] = useState<RainbowConditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    initializeLocation();
    const interval = setInterval(updateRainbowConditions, 60000); // Обновляем каждую минуту
    return () => clearInterval(interval);
  }, []);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Разрешение на использование геолокации отклонено');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      await updateRainbowConditions(currentLocation);
    } catch (error) {
      console.error('Ошибка получения геолокации:', error);
      Alert.alert('Ошибка', 'Не удалось получить текущее местоположение');
    } finally {
      setLoading(false);
    }
  };

  const updateRainbowConditions = async (currentLocation?: Location.LocationObject) => {
    if (!currentLocation && !location) return;
    
    const loc = currentLocation || location!;
    setLoading(true);

    try {
      // Получаем погодные данные
      const weather = await WeatherService.getCurrentWeather(
        loc.coords.latitude,
        loc.coords.longitude
      );

      // Рассчитываем положение солнца
      const sunData = SunCalculator.calculateSunPosition(
        loc.coords.latitude,
        loc.coords.longitude,
        new Date()
      );

      // Рассчитываем вероятность радуги
      const rainbowProbability = RainbowCalculator.calculateRainbowProbability({
        weather,
        sunAngle: sunData.altitude,
        sunAzimuth: sunData.azimuth,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      // Определяем направление радуги (42° от антисолярной точки)
      const rainbowDirection = (sunData.azimuth + 180 + 42) % 360;

      // Определяем следующее оптимальное время
      const nextOptimalTime = RainbowCalculator.getNextOptimalTime(
        loc.coords.latitude,
        loc.coords.longitude
      );

      setRainbowConditions({
        probability: rainbowProbability,
        sunAngle: sunData.altitude,
        sunAzimuth: sunData.azimuth,
        weather,
        rainbowDirection,
        isOptimal: rainbowProbability > 60,
        nextOptimalTime,
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Ошибка обновления данных:', error);
      Alert.alert('Ошибка', 'Не удалось обновить данные о радуге');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    updateRainbowConditions();
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return '#10b981'; // green
    if (probability >= 60) return '#f59e0b'; // yellow
    if (probability >= 40) return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  const getProbabilityText = (probability: number) => {
    if (probability >= 80) return 'Очень высокая';
    if (probability >= 60) return 'Высокая';
    if (probability >= 40) return 'Средняя';
    if (probability >= 20) return 'Низкая';
    return 'Очень низкая';
  };

  if (loading && !rainbowConditions) {
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Поиск радуги...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Заголовок */}
        <View style={styles.header}>
          <Text style={styles.title}>🌈 Поиск радуги</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Основная карточка с вероятностью */}
        {rainbowConditions && (
          <View style={styles.mainCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.cardGradient}
            >
              <RainbowMeter probability={rainbowConditions.probability} />
              
              <Text style={styles.probabilityText}>
                {getProbabilityText(rainbowConditions.probability)}
              </Text>
              
              <Text style={styles.probabilityValue}>
                {rainbowConditions.probability.toFixed(0)}%
              </Text>

              {rainbowConditions.isOptimal && (
                <View style={styles.optimalBadge}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.optimalText}>Оптимальные условия!</Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Направление радуги */}
        {rainbowConditions && (
          <View style={styles.directionCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.cardGradient}
            >
              <Text style={styles.cardTitle}>Направление радуги</Text>
              <View style={styles.directionInfo}>
                <Ionicons name="compass" size={32} color="#fff" />
                <Text style={styles.directionText}>
                  {rainbowConditions.rainbowDirection.toFixed(0)}°
                </Text>
                <Text style={styles.directionLabel}>
                  {getCompassDirection(rainbowConditions.rainbowDirection)}
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Информация о солнце */}
        {rainbowConditions && (
          <SunInfoCard
            sunAngle={rainbowConditions.sunAngle}
            sunAzimuth={rainbowConditions.sunAzimuth}
          />
        )}

        {/* Погодная карточка */}
        {rainbowConditions && (
          <WeatherCard weather={rainbowConditions.weather} />
        )}

        {/* Следующее оптимальное время */}
        {rainbowConditions?.nextOptimalTime && (
          <View style={styles.nextTimeCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.cardGradient}
            >
              <Text style={styles.cardTitle}>Следующая возможность</Text>
              <Text style={styles.nextTimeText}>
                {rainbowConditions.nextOptimalTime.toLocaleString('ru-RU')}
              </Text>
            </LinearGradient>
          </View>
        )}

        <Text style={styles.lastUpdate}>
          Обновлено: {lastUpdate.toLocaleTimeString('ru-RU')}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const getCompassDirection = (azimuth: number) => {
  const directions = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  const index = Math.round(azimuth / 45) % 8;
  return directions[index];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
  },
  mainCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  probabilityText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  probabilityValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  optimalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
  },
  optimalText: {
    color: '#fbbf24',
    fontWeight: '600',
    marginLeft: 4,
  },
  directionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  directionInfo: {
    alignItems: 'center',
  },
  directionText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  directionLabel: {
    fontSize: 16,
    color: '#e5e7eb',
    marginTop: 4,
  },
  nextTimeCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextTimeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  lastUpdate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 16,
  },
}); 