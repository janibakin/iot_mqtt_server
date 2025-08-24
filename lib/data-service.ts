
import { prisma } from './db';
import type { HistoricalDataRequest, ChartDataPoint, TimeGranularity } from './types';

export class DataService {
  static async getCurrentReading(deviceId = 'esp32-01') {
    const reading = await prisma.sensorReading.findFirst({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
    });
    
    return reading;
  }

  static async getDeviceStatus(deviceId = 'esp32-01') {
    const status = await prisma.deviceStatus.findUnique({
      where: { deviceId },
    });
    
    return status;
  }

  static async getHistoricalData(
    timeRange: TimeGranularity,
    deviceId = 'esp32-01'
  ): Promise<ChartDataPoint[]> {
    const now = new Date();
    let startDate: Date;
    let groupBy = 'hour'; // Default grouping

    // Determine date range and grouping
    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupBy = 'hour';
        break;
      case '1m':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '3m':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '6m':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        groupBy = 'week';
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        groupBy = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // For now, use simplified aggregation using Prisma queries
    // In production, you might want to use proper raw SQL or time-series database
    try {
      const readings = await prisma.sensorReading.findMany({
        where: {
          deviceId,
          timestamp: {
            gte: startDate,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Group data based on time range
      const groupedData = this.groupDataByTimeRange(readings, timeRange);
      
      return groupedData.map((item) => ({
        timestamp: item.timestamp,
        temperature: parseFloat(item.temperature.toFixed(1)),
        humidity: parseFloat(item.humidity.toFixed(1)),
        date: new Date(item.timestamp).toLocaleDateString(),
        time: new Date(item.timestamp).toLocaleTimeString(),
      }));
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  private static groupDataByTimeRange(readings: any[], timeRange: TimeGranularity) {
    if (readings.length === 0) return [];

    const grouped = new Map();
    
    readings.forEach((reading) => {
      let key: string;
      const date = new Date(reading.timestamp);
      
      switch (timeRange) {
        case '1d':
          // Group by hour
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString();
          break;
        case '1m':
        case '3m':
          // Group by day
          key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
          break;
        case '6m':
          // Group by week (start of week)
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          key = startOfWeek.toISOString();
          break;
        case '1y':
          // Group by month
          key = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
          break;
        default:
          key = reading.timestamp;
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          timestamp: key,
          temperatures: [],
          humidities: [],
        });
      }
      
      grouped.get(key).temperatures.push(reading.temperature);
      grouped.get(key).humidities.push(reading.humidity);
    });
    
    // Convert to averages
    const result = Array.from(grouped.values()).map((group) => ({
      timestamp: group.timestamp,
      temperature: group.temperatures.reduce((a: number, b: number) => a + b, 0) / group.temperatures.length,
      humidity: group.humidities.reduce((a: number, b: number) => a + b, 0) / group.humidities.length,
    }));
    
    return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  static async getLatestReadings(limit = 100, deviceId = 'esp32-01') {
    const readings = await prisma.sensorReading.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    
    return readings.reverse(); // Show oldest first
  }

  static async getAverageReadings(hours = 24, deviceId = 'esp32-01') {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const result = await prisma.sensorReading.aggregate({
      where: {
        deviceId,
        timestamp: {
          gte: startDate,
        },
      },
      _avg: {
        temperature: true,
        humidity: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      avgTemperature: result._avg.temperature || 0,
      avgHumidity: result._avg.humidity || 0,
      readingCount: result._count.id || 0,
    };
  }
}
