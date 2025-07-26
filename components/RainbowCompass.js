import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(width * 0.7, 280);

export const RainbowCompass = ({ 
  rainbowDirection, 
  probability, 
  sunPosition, 
  userLocation 
}) => {
  
  if (!rainbowDirection || probability < 10) {
    return (
      <View style={styles.compassContainer}>
        <View style={styles.inactiveCompass}>
          <Text style={styles.inactiveText}>Компас неактивен</Text>
          <Text style={styles.inactiveSubtext}>Вероятность радуги слишком низкая</Text>
        </View>
      </View>
    );
  }

  const direction = rainbowDirection.center;
  const arrowRotation = direction - 90; // Корректируем для правильного отображения

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

  const directionName = getDirectionName(direction);

  // Цвет стрелки зависит от вероятности
  const getArrowColor = () => {
    if (probability >= 70) return '#10b981'; // Зеленый
    if (probability >= 50) return '#f59e0b'; // Желтый
    if (probability >= 30) return '#ef4444'; // Красный
    return '#6b7280'; // Серый
  };

  return (
    <View style={styles.compassContainer}>
      <Text style={styles.compassTitle}>🧭 Направление на радугу</Text>
      
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
          
          {/* Основная стрелка направления радуги */}
          <View
            style={[
              styles.rainbowArrow,
              {
                transform: [{ rotate: `${arrowRotation}deg` }]
              }
            ]}
          >
            <LinearGradient
              colors={[getArrowColor(), `${getArrowColor()}AA`]}
              style={styles.arrowGradient}
            >
              <Ionicons 
                name="arrow-up" 
                size={32} 
                color="white"
                style={styles.arrowIcon}
              />
            </LinearGradient>
          </View>
          
          {/* Индикатор солнца */}
          <View
            style={[
              styles.sunIndicator,
              {
                transform: [{ rotate: `${(sunPosition?.azimuth || 0) - 90}deg` }]
              }
            ]}
          >
            <Ionicons name="sunny" size={16} color="#f59e0b" />
          </View>
          
        </LinearGradient>
      </View>
      
      {/* Информация о направлении */}
      <View style={styles.directionInfo}>
        <View style={styles.directionRow}>
          <Text style={styles.directionLabel}>Направление:</Text>
          <Text style={[styles.directionValue, { color: getArrowColor() }]}>
            {Math.round(direction)}° ({directionName})
          </Text>
        </View>
        
        <View style={styles.directionRow}>
          <Text style={styles.directionLabel}>Точность:</Text>
          <Text style={styles.directionValue}>
            ±{rainbowDirection.range ? '1' : '2'}°
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
        <Text style={styles.instructionTitle}>📋 Как искать радугу:</Text>
        <Text style={styles.instructionText}>
          1. Встаньте спиной к солнцу{'\n'}
          2. Поверните телефон по направлению стрелки{'\n'}
          3. Смотрите на небо под углом ~42° от горизонта{'\n'}
          4. Радуга появится в виде дуги в этом направлении
        </Text>
      </View>
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
    marginBottom: 20,
    textAlign: 'center',
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
  
  rainbowArrow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    top: -80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    transformOrigin: '25px 105px',
  },
  
  arrowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  arrowIcon: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  sunIndicator: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    top: -100,
    transformOrigin: '12px 112px',
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
    fontFamily: 'monospace',
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