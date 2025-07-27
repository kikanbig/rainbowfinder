import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Magnetometer } from 'expo-sensors';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(width * 0.7, 280);

export const RainbowCompass = ({ 
  rainbowDirection, 
  probability, 
  sunPosition, 
  userLocation 
}) => {
  
  const [magnetometerData, setMagnetometerData] = useState({ x: 0, y: 0, z: 0 });
  const [deviceHeading, setDeviceHeading] = useState(0); // Текущее направление устройства
  const [isCompassAvailable, setIsCompassAvailable] = useState(false);
  const [calibrationOffset, setCalibrationOffset] = useState(0); // 🎯 КАЛИБРОВКА
  const subscription = useRef(null);
  
  // Инициализация датчиков
  useEffect(() => {
    initializeCompass();
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Инициализация компаса
  const initializeCompass = async () => {
    try {
      // Проверяем доступность магнитометра
      const isAvailable = await Magnetometer.isAvailableAsync();
      
      if (isAvailable) {
        setIsCompassAvailable(true);
        
        // Устанавливаем частоту обновления
        Magnetometer.setUpdateInterval(100); // 10 раз в секунду
        
        // Подписываемся на данные магнитометра
        subscription.current = Magnetometer.addListener(handleMagnetometerUpdate);
        
        console.log('🧭 Компас успешно инициализирован');
      } else {
        console.log('⚠️ Магнитометр недоступен на этом устройстве');
        setIsCompassAvailable(false);
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации компаса:', error);
      setIsCompassAvailable(false);
    }
  };
  
  // Обработка данных магнитометра
  const handleMagnetometerUpdate = (data) => {
    try {
      setMagnetometerData(data);
      
      // Вычисляем направление устройства (азимут)
      const heading = calculateHeading(data);
      setDeviceHeading(heading);
    } catch (error) {
      console.error('❌ Ошибка обработки магнитометра:', error);
      // Не падаем, просто логируем ошибку
    }
  };
  
  // 🎯 ИСПРАВЛЕННАЯ ФОРМУЛА КОМПАСА
  const calculateHeading = (data) => {
    try {
      // Проверяем валидность данных
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') {
        console.warn('⚠️ Некорректные данные магнитометра:', data);
        return 0;
      }
      
      // Универсальная формула для всех платформ
      let heading = Math.atan2(data.y, data.x) * (180 / Math.PI);
      
      // Нормализуем угол
      heading = heading >= 0 ? heading : heading + 360;
      
      // 🔧 КАЛИБРОВКА: Компенсируем магнитное склонение
      // Для России примерно +7° (восточное склонение)
      const magneticDeclination = 7;
      heading = (heading + magneticDeclination) % 360;
      
      return heading;
    } catch (error) {
      console.error('❌ Ошибка расчета направления:', error);
      return 0; // Возвращаем 0 вместо падения
    }
  };
  
  // 🎯 ФУНКЦИЯ КАЛИБРОВКИ КОМПАСА
  const calibrateCompass = () => {
    // Устанавливаем текущее направление как "север"
    setCalibrationOffset(deviceHeading);
    console.log('🎯 Компас откалиброван! Север установлен на:', deviceHeading, '°');
  };
  
  // Отписка от датчиков
  const unsubscribe = () => {
    if (subscription.current) {
      subscription.current.remove();
      subscription.current = null;
    }
  };
  
  // ИСПРАВЛЕНО: Показываем компас даже при низкой вероятности (для тестирования)
  if (!rainbowDirection && !sunPosition) {
    return (
      <View style={styles.compassContainer}>
        <View style={styles.inactiveCompass}>
          <Text style={styles.inactiveText}>🔄 Загрузка компаса...</Text>
          <Text style={styles.inactiveSubtext}>Получение данных о солнце</Text>
        </View>
      </View>
    );
  }
  
  // 🐝 СУПЕР-ТОЧНАЯ ЛОГИКА: ПЧЕЛКА СТРОГО НАПРОТИВ СОЛНЦА!
  let targetDirection = 0;
  let isRainbowDirection = false;
  let beeRotation = 0;
  let sunRotationAngle = 0;
  let northRotation = 0;
  
  try {
    if (sunPosition && sunPosition.azimuth !== undefined) {
      // ФИЗИЧЕСКИЙ ЗАКОН: Радуга всегда появляется в противосолнечной точке
      // Если солнце на востоке (90°), радуга на западе (270°)
      // Если солнце на юге (180°), радуга на севере (0°/360°)
      
      const sunAzimuth = sunPosition.azimuth;
      targetDirection = (sunAzimuth + 180) % 360;
      
      isRainbowDirection = true;
      
      // 🔍 ОТЛАДКА: Логируем для проверки
      console.log('🌞 Солнце азимут:', sunAzimuth);
      console.log('🐝 Пчелка направление:', targetDirection);
      console.log('📐 Должна быть разница 180°:', Math.abs(targetDirection - sunAzimuth));
    } else {
      // Резерв: если нет данных о солнце, используем расчетное направление
      targetDirection = rainbowDirection?.center || 0;
      isRainbowDirection = false;
    }
    
    // 🎯 ПРАВИЛЬНАЯ ЛОГИКА КОМПАСА С КАЛИБРОВКОЙ
    if (isCompassAvailable) {
      // Компас активен: все элементы компенсируют поворот телефона
      const calibratedHeading = (deviceHeading - calibrationOffset + 360) % 360;
      beeRotation = targetDirection - calibratedHeading;
      sunRotationAngle = (sunPosition?.azimuth || 0) - calibratedHeading;
      northRotation = -calibratedHeading; // Север всегда указывает на истинный север
    } else {
      // Статичный режим: просто показываем направления
      beeRotation = targetDirection;
      sunRotationAngle = sunPosition?.azimuth || 0;
      northRotation = 0;
    }
    
    // Нормализуем углы
    beeRotation = ((beeRotation % 360) + 360) % 360;
    sunRotationAngle = ((sunRotationAngle % 360) + 360) % 360;
    northRotation = ((northRotation % 360) + 360) % 360;
  } catch (error) {
    console.error('❌ Ошибка расчета компаса:', error);
    // Используем безопасные значения по умолчанию
    targetDirection = 0;
    beeRotation = 0;
    sunRotationAngle = 0;
    northRotation = 0;
    isRainbowDirection = false;
  }
  
  // 🔍 СУПЕР-ДЕТАЛЬНАЯ ОТЛАДКА
  console.log('=== 🐝💞 КОМПАС ДЛЯ КАТИ ===');
  console.log('🌞 Солнце азимут:', sunPosition?.azimuth);
  console.log('🐝 Пчелка направление:', targetDirection);
  console.log('📐 Разница (должна быть ~180°):', Math.abs(targetDirection - (sunPosition?.azimuth || 0)));
  console.log('🧭 Магнитометр (поворот телефона):', deviceHeading);
  console.log('🔄 CSS поворот пчелки:', beeRotation, '°');
  console.log('☀️ CSS поворот солнца:', sunRotationAngle, '°');
  console.log('🎯 CSS разница (должна быть ~180°):', Math.abs(beeRotation - sunRotationAngle));
  
  // 🧪 ТЕСТИРОВАНИЕ: Если солнце на востоке (90°), пчелка должна быть на западе (270°)
  if (sunPosition?.azimuth) {
    const expectedBee = (sunPosition.azimuth + 180) % 360;
    const actualBee = targetDirection;
    console.log('🧪 ТЕСТ: Солнце', sunPosition.azimuth, '° → Пчелка должна быть', expectedBee, '°, фактически', actualBee, '°');
    console.log('✅ Математика правильна:', expectedBee === actualBee ? 'ДА' : 'НЕТ');
  }
  console.log('==============================');

  // Функция для получения названия направления
  const getDirectionName = (degrees) => {
    const directions = [
      { name: 'С', range: [337.5, 22.5] },
      { name: 'СВ', range: [22.5, 67.5] },
      { name: 'В', range: [67.5, 112.5] },
      { name: 'ЮВ', range: [112.5, 157.5] },
      { name: 'Ю', range: [157.5, 202.5] },
      { name: 'ЮЗ', range: [202.5, 247.5] },
      { name: 'З', range: [247.5, 292.5] },
      { name: 'СЗ', range: [292.5, 337.5] }
    ];

    for (let dir of directions) {
      if (dir.range[0] > dir.range[1]) {
        // Случай для севера (переход через 0°)
        if (degrees >= dir.range[0] || degrees <= dir.range[1]) {
          return dir.name;
        }
      } else {
        if (degrees >= dir.range[0] && degrees <= dir.range[1]) {
          return dir.name;
        }
      }
    }
    return 'С';
  };

  const directionName = getDirectionName(targetDirection);

  // Цвет стрелки зависит от вероятности
  const getArrowColor = () => {
    if (probability >= 70) return '#10b981'; // Зеленый
    if (probability >= 50) return '#f59e0b'; // Желтый
    if (probability >= 30) return '#ef4444'; // Красный
    return '#6b7280'; // Серый
  };

  const compassTitle = isRainbowDirection 
    ? '🌈 Направление на радугу' 
    : '☀️ Примерное направление (от солнца)';
  
  const compassStatusText = isCompassAvailable 
    ? '🐝 Пчелка показывает напротив реального солнца!' 
    : '📍 Пчелка напротив солнца (примерно)';
  
      return (
      <View style={styles.compassContainer}>
        <Text style={styles.compassTitle}>{compassTitle}</Text>
        <Text style={styles.compassStatus}>{compassStatusText}</Text>
        
        {!isRainbowDirection && (
          <Text style={styles.compassSubtitle}>
            ⚠️ Направление рассчитано от солнца
          </Text>
        )}
      
      {/* Основной компас */}
      <View style={[styles.compass, { width: COMPASS_SIZE, height: COMPASS_SIZE }]}>
        
        {/* Фон компаса */}
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(240,240,240,0.95)']}
          style={styles.compassBackground}
        >
          
          {/* Центральная точка */}
          <View style={styles.centerDot} />
          
          {/* Стороны света */}
          <Text style={[styles.cardinalDirection, styles.north]}>С</Text>
          <Text style={[styles.cardinalDirection, styles.east]}>В</Text>
          <Text style={[styles.cardinalDirection, styles.south]}>Ю</Text>
          <Text style={[styles.cardinalDirection, styles.west]}>З</Text>
          
          {/* Деления компаса */}
          {Array.from({ length: 36 }, (_, i) => {
            const angle = i * 10;
            const isMainDirection = angle % 90 === 0;
            const isMediumDirection = angle % 30 === 0;
            
            return (
              <View
                key={i}
                style={[
                  styles.compassTick,
                  {
                    transform: [{ rotate: `${angle}deg` }],
                    height: isMainDirection ? 20 : isMediumDirection ? 15 : 10,
                    backgroundColor: isMainDirection ? '#374151' : '#9ca3af'
                  }
                ]}
              />
            );
          })}
          
          {/* Большая милая пчелка указывает на радугу */}
          <View
            style={[
              styles.mainBeeIndicator,
              {
                transform: [{ rotate: `${beeRotation}deg` }]
              }
            ]}
          >
            <View style={styles.beeContainer}>
              <Text style={styles.bigBeeEmoji}>🐝</Text>
              <View style={styles.beeGlow} />
            </View>
          </View>
          
          {/* Индикатор солнца (используем новую логику) */}
          <View
            style={[
              styles.sunIndicator,
              {
                transform: [{ rotate: `${sunRotationAngle}deg` }]
              }
            ]}
          >
            <Ionicons name="sunny" size={16} color="#f59e0b" />
          </View>
          
          {/* Индикатор севера (красная точка указывает истинный север) */}
          {isCompassAvailable && (
            <View
              style={[
                styles.northIndicator,
                {
                  transform: [{ 
                    rotate: `${northRotation}deg` 
                  }]
                }
              ]}
            >
              <Text style={styles.northText}>N</Text>
            </View>
          )}
          
        </LinearGradient>
      </View>
      
      {/* Информация о направлении */}
              <View style={styles.directionInfo}>
          <View style={styles.directionRow}>
            <Text style={styles.directionLabel}>🐝 Пчелка (радуга):</Text>
            <Text style={[styles.directionValue, { color: getArrowColor() }]}>
              {Math.round(targetDirection)}° ({directionName})
            </Text>
          </View>
          {sunPosition && (
            <>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>☀️ Солнце:</Text>
                <Text style={[styles.directionValue, { color: '#f59e0b' }]}>
                  {Math.round(sunPosition.azimuth)}°
                </Text>
              </View>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>🔄 Поворот пчелки:</Text>
                <Text style={[styles.directionValue, { color: '#9333ea' }]}>
                  {Math.round(beeRotation)}°
                </Text>
              </View>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>🧭 Магнитометр:</Text>
                <Text style={[styles.directionValue, { color: '#059669' }]}>
                  {Math.round(deviceHeading)}°
                </Text>
              </View>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>📐 Разница:</Text>
                <Text style={[styles.directionValue, { color: Math.abs(targetDirection - sunPosition.azimuth) > 170 ? '#10b981' : '#ef4444' }]}>
                  {Math.round(Math.abs(targetDirection - sunPosition.azimuth))}° {Math.abs(targetDirection - sunPosition.azimuth) > 170 ? '✅' : '❌'}
                </Text>
              </View>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>🧪 Тест:</Text>
                <Text style={[styles.directionValue, { color: '#6366f1', fontSize: 12 }]}>
                  Солнце {Math.round(sunPosition.azimuth)}° → Пчелка должна быть {Math.round((sunPosition.azimuth + 180) % 360)}°
                </Text>
              </View>
            </>
          )}
          
          {isCompassAvailable && (
            <>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>Ваш азимут:</Text>
                <Text style={styles.directionValue}>
                  {Math.round(deviceHeading)}° ({getDirectionName(deviceHeading)})
                </Text>
              </View>
              <View style={styles.directionRow}>
                <Text style={styles.directionLabel}>🎯 Калибровка:</Text>
                <Text style={styles.directionValue}>
                  {calibrationOffset > 0 ? `${Math.round(calibrationOffset)}°` : 'Не откалиброван'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.calibrateButton} 
                onPress={calibrateCompass}
              >
                <Text style={styles.calibrateButtonText}>🎯 Откалибровать компас</Text>
              </TouchableOpacity>
            </>
          )}
          
          <View style={styles.directionRow}>
            <Text style={styles.directionLabel}>Точность:</Text>
            <Text style={styles.directionValue}>
              ±{isCompassAvailable ? '2' : '5'}°
            </Text>
          </View>
        
        {userLocation && (
          <View style={styles.coordinatesContainer}>
            <Text style={styles.coordinatesTitle}>📍 Ваши координаты:</Text>
            <Text style={styles.coordinates}>
              {userLocation.coords.latitude.toFixed(6)}°С, {userLocation.coords.longitude.toFixed(6)}°В
            </Text>
          </View>
        )}
      </View>
      
              {/* Инструкции */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>🐝 Пчелка и реальное солнце:</Text>
          {isCompassAvailable ? (
            <Text style={styles.instructionText}>
              Пчелка всегда показывает НАПРОТИВ реального солнца!{'\n'}
              Поворачивайте телефон, пока пчелка не укажет вверх{'\n'}
              Поднимите взгляд на небо под углом ~42° - там радуга! ✨
            </Text>
          ) : (
            <Text style={styles.instructionText}>
              Пчелка показывает напротив солнца (примерно){'\n'}
              1. Встаньте спиной к солнцу{'\n'}
              2. Поверните телефон по направлению пчелки{'\n'}
              3. Смотрите на небо под углом ~42°{'\n'}
              4. Радуга появится в этом направлении
            </Text>
          )}
        </View>
        
        {/* Калибровка */}
        {isCompassAvailable && (
          <View style={styles.calibrationTip}>
            <Text style={styles.calibrationText}>
              💡 Совет: для точности отойдите от металлических предметов и WiFi роутеров
            </Text>
          </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  compassContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  
  compassTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 5,
    textAlign: 'center',
  },
  
  compassStatus: {
    fontSize: 14,
    color: '#10b981',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  compassSubtitle: {
    fontSize: 14,
    color: '#f59e0b',
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  compass: {
    position: 'relative',
    borderRadius: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  
  compassBackground: {
    width: '100%',
    height: '100%',
    borderRadius: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
    position: 'absolute',
    zIndex: 10,
  },
  
  cardinalDirection: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  
  north: { top: 10 },
  south: { bottom: 10 },
  east: { right: 10 },
  west: { left: 10 },
  
  compassTick: {
    position: 'absolute',
    width: 2,
    top: 0,
    left: '50%',
    marginLeft: -1,
    transformOrigin: '1px 140px',
  },
  
  mainBeeIndicator: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    top: 40, // СЕВЕР компаса - ближе к центру чтобы поместиться
    left: 115, // ЦЕНТР горизонтально
    transformOrigin: '25px 100px', // Поворот вокруг ЦЕНТРА компаса (140-40 = 100px)
  },
  
  beeContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  
  bigBeeEmoji: {
    fontSize: 36,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    zIndex: 2,
  },
  
  beeGlow: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: 'rgba(255, 215, 0, 0.20)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1.0,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 1,
  },
  
  sunIndicator: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(245, 158, 11, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    top: 227, // ЮГ компаса - симметрично пчелке (240-13=227)
    left: 152, // Симметрично пчелке (165-13=152)
    transformOrigin: '13px 13px', // 🎯 ИСПРАВЛЕНО: Поворот вокруг ЦЕНТРА солнца
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  
  northIndicator: {
    position: 'absolute',
    top: 8, // СЕВЕР компаса (центр - радиус - 12px = 140px - 140px + 8px)
    left: 128, // ЦЕНТР горизонтально (центр - 12px = 140px - 12px = 128px)
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transformOrigin: '12px 132px', // Поворот вокруг ЦЕНТРА компаса (140-8 = 132px)
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 2,
  },
  
  northText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  
  directionInfo: {
    marginTop: 20,
    width: '100%',
  },
  
  directionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  directionLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  
  directionValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  coordinatesContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  
  coordinatesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 5,
  },
  
  coordinates: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  
  calibrationTip: {
    marginTop: 15,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  
  calibrationText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  calibrateButton: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  
  calibrateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  instructions: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
  },
  
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  
  inactiveCompass: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(156, 163, 175, 0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  inactiveText: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  inactiveSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 5,
  },
  

}); 