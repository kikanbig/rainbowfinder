/**
 * Система логирования для RainbowFinder
 * Помогает диагностировать проблемы в реальном времени
 */

class Logger {
  static logs = [];
  static maxLogs = 100;

  static log(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      data: data ? JSON.stringify(data, null, 2) : null
    };

    // Добавляем в массив логов
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Выводим в консоль с эмодзи
    const emoji = {
      'ERROR': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️',
      'DEBUG': '🔍',
      'SUCCESS': '✅'
    };

    const prefix = `${emoji[level] || '📝'} [${category}]`;
    
    if (level === 'ERROR') {
      console.error(`${prefix} ${message}`, data || '');
    } else if (level === 'WARN') {
      console.warn(`${prefix} ${message}`, data || '');
    } else {
      console.log(`${prefix} ${message}`, data || '');
    }
  }

  static error(category, message, data) {
    this.log('ERROR', category, message, data);
  }

  static warn(category, message, data) {
    this.log('WARN', category, message, data);
  }

  static info(category, message, data) {
    this.log('INFO', category, message, data);
  }

  static debug(category, message, data) {
    this.log('DEBUG', category, message, data);
  }

  static success(category, message, data) {
    this.log('SUCCESS', category, message, data);
  }

  static getLogs() {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
  }

  static getLogsAsString() {
    return this.logs.map(log => 
      `[${log.timestamp}] ${log.level} [${log.category}] ${log.message}${log.data ? '\n' + log.data : ''}`
    ).join('\n\n');
  }
}

export default Logger; 