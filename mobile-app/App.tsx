import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Services
import { NotificationService } from './src/services/NotificationService';
import { LocationService } from './src/services/LocationService';

const Tab = createBottomTabNavigator();

// Настройка уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);
  const [isNotificationPermissionGranted, setIsNotificationPermissionGranted] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      // Запрос разрешений на геолокацию
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus === 'granted') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        setIsLocationPermissionGranted(backgroundStatus === 'granted');
      }

      // Запрос разрешений на уведомления
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      setIsNotificationPermissionGranted(notificationStatus === 'granted');

      // Инициализация сервисов
      if (locationStatus === 'granted') {
        await LocationService.initialize();
      }
      
      if (notificationStatus === 'granted') {
        await NotificationService.initialize();
      }

    } catch (error) {
      console.error('Ошибка при запросе разрешений:', error);
      Alert.alert(
        'Ошибка',
        'Не удалось получить необходимые разрешения. Приложение может работать некорректно.'
      );
    }
  };

  return (
    <NavigationContainer>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.container}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;

              if (route.name === 'Главная') {
                iconName = focused ? 'rainbow' : 'rainbow-outline';
              } else if (route.name === 'Карта') {
                iconName = focused ? 'map' : 'map-outline';
              } else if (route.name === 'Настройки') {
                iconName = focused ? 'settings' : 'settings-outline';
              } else {
                iconName = 'help-circle-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#6366f1',
            tabBarInactiveTintColor: 'gray',
            tabBarStyle: {
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              elevation: 0,
            },
            headerStyle: {
              backgroundColor: 'transparent',
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          })}
        >
          <Tab.Screen 
            name="Главная" 
            component={HomeScreen}
            options={{
              title: '🌈 RainbowFinder',
            }}
          />
          <Tab.Screen 
            name="Карта" 
            component={MapScreen}
            options={{
              title: 'Карта радуги',
            }}
          />
          <Tab.Screen 
            name="Настройки" 
            component={SettingsScreen}
            options={{
              title: 'Настройки',
            }}
          />
        </Tab.Navigator>
        <StatusBar style="light" />
      </LinearGradient>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 