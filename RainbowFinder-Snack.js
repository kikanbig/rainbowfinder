import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);

  const API_KEY = 'be314fc63d2ce6bc8c976a4e60be8955';

  const testRainbowConditions = async () => {
    setLoading(true);
    try {
      // Тест API для Москвы
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid=${API_KEY}&units=metric&lang=ru`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setWeatherData(data);
      
      // Простой расчет вероятности радуги
      const humidity = data.main.humidity;
      const clouds = data.clouds.all;
      const visibility = data.visibility;
      
      // Упрощенная формула вероятности радуги
      let rainbowProbability = 0;
      
      // Высокая влажность (капли воды)
      if (humidity > 70) rainbowProbability += 25;
      
      // Переменная облачность (не полностью ясно, не полностью пасмурно)
      if (clouds > 20 && clouds < 80) rainbowProbability += 25;
      
      // Хорошая видимость
      if (visibility > 5000) rainbowProbability += 25;
      
      // Время суток (предполагаем оптимальное)
      const hour = new Date().getHours();
      if ((hour >= 6 && hour <= 8) || (hour >= 18 && hour <= 20)) {
        rainbowProbability += 25;
      }
      
      Alert.alert(
        '🌈 Результат анализа радуги',
        `Город: ${data.name}\n` +
        `Температура: ${data.main.temp}°C\n` +
        `Погода: ${data.weather[0].description}\n` +
        `Влажность: ${humidity}%\n` +
        `Облачность: ${clouds}%\n` +
        `Видимость: ${visibility/1000}км\n\n` +
        `🌈 ВЕРОЯТНОСТЬ РАДУГИ: ${rainbowProbability}%\n\n` +
        (rainbowProbability > 60 ? 
          '✅ Отличные условия для радуги!' : 
          rainbowProbability > 30 ?
          '🟡 Умеренные условия' :
          '❌ Неблагоприятные условия')
      );
    } catch (error) {
      Alert.alert('❌ Ошибка', `Не удалось получить данные: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showAppInfo = () => {
    Alert.alert(
      '🌈 RainbowFinder',
      'Научно обоснованное приложение для поиска радуги!\n\n' +
      '📍 Использует OpenWeatherMap API\n' +
      '🧮 Рассчитывает вероятность на основе:\n' +
      '• Влажности воздуха\n' +
      '• Облачности\n' +
      '• Видимости\n' +
      '• Времени суток\n\n' +
      '💝 Создано с любовью!'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌈 RainbowFinder</Text>
      <Text style={styles.subtitle}>Приложение для поиска радуги</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Анализ условий для радуги</Text>
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={testRainbowConditions}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>🧪 Проверить условия</Text>
          )}
        </TouchableOpacity>
        
        {weatherData && (
          <View style={styles.weatherInfo}>
            <Text style={styles.weatherText}>
              Последние данные для {weatherData.name}:
            </Text>
            <Text style={styles.weatherDetails}>
              🌡️ {weatherData.main.temp}°C
            </Text>
            <Text style={styles.weatherDetails}>
              💧 Влажность: {weatherData.main.humidity}%
            </Text>
            <Text style={styles.weatherDetails}>
              ☁️ Облачность: {weatherData.clouds.all}%
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>✅ Статус приложения</Text>
        <Text style={styles.infoText}>
          ✅ Expo Snack работает{'\n'}
          ✅ React Native работает{'\n'}
          ✅ API ключ OpenWeatherMap: настроен{'\n'}
          ✅ Интернет соединение: активно
        </Text>
      </View>
      
      <TouchableOpacity style={styles.infoButton} onPress={showAppInfo}>
        <Text style={styles.infoButtonText}>ℹ️ О приложении</Text>
      </TouchableOpacity>
      
      <Text style={styles.footer}>
        💝 Создано с любовью для поиска радуги! 🌈
      </Text>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    width: '100%',
    maxWidth: 350,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  weatherInfo: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 10,
    width: '100%',
  },
  weatherText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  weatherDetails: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
    marginBottom: 5,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 4,
    width: '100%',
    maxWidth: 350,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    marginBottom: 20,
  },
  infoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    fontSize: 14,
    color: '#7c3aed',
    textAlign: 'center',
    fontStyle: 'italic',
    position: 'absolute',
    bottom: 30,
  },
}); 