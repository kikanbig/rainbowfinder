import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../utils/Logger';

export const LogViewer = ({ visible, onClose }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const logs = Logger.getLogs();
  
  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  const clearLogs = () => {
    Logger.clearLogs();
    setRefreshKey(prev => prev + 1);
  };
  
  const getLogColor = (level) => {
    switch (level) {
      case 'ERROR': return '#ef4444';
      case 'WARN': return '#f59e0b';
      case 'SUCCESS': return '#10b981';
      case 'INFO': return '#3b82f6';
      case 'DEBUG': return '#6b7280';
      default: return '#374151';
    }
  };
  
  const getLogEmoji = (level) => {
    switch (level) {
      case 'ERROR': return '❌';
      case 'WARN': return '⚠️';
      case 'SUCCESS': return '✅';
      case 'INFO': return 'ℹ️';
      case 'DEBUG': return '🔍';
      default: return '📝';
    }
  };
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={styles.container}>
        {/* Заголовок */}
        <View style={styles.header}>
          <Text style={styles.title}>🔍 Диагностика RainbowFinder</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={refresh}>
              <Ionicons name="refresh" size={24} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={clearLogs}>
              <Ionicons name="trash" size={24} color="#ef4444" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Статистика */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            📊 Всего логов: {logs.length} | 
            ❌ Ошибки: {logs.filter(l => l.level === 'ERROR').length} |
            ⚠️ Предупреждения: {logs.filter(l => l.level === 'WARN').length}
          </Text>
        </View>
        
        {/* Логи */}
        <ScrollView style={styles.logsContainer} key={refreshKey}>
          {logs.length === 0 ? (
            <Text style={styles.noLogs}>Логи пусты</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <View style={styles.logHeader}>
                  <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                    {getLogEmoji(log.level)} {log.level}
                  </Text>
                  <Text style={styles.logCategory}>[{log.category}]</Text>
                  <Text style={styles.logTime}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.data && (
                  <Text style={styles.logData}>{log.data}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  
  stats: {
    padding: 12,
    backgroundColor: '#ede9fe',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  statsText: {
    fontSize: 12,
    color: '#6b46c1',
    textAlign: 'center',
  },
  
  logsContainer: {
    flex: 1,
    padding: 8,
  },
  
  noLogs: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#6b7280',
  },
  
  logEntry: {
    backgroundColor: 'white',
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  logHeader: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  
  logCategory: {
    fontSize: 12,
    color: '#6b46c1',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  
  logTime: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 'auto',
  },
  
  logMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  
  logData: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
});

export default LogViewer; 