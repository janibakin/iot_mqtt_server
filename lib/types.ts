
export interface SensorData {
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface SensorReading {
  id: string;
  deviceId: string;
  temperature: number;
  humidity: number;
  timestamp: Date;
  createdAt: Date;
}

export interface DeviceStatus {
  id: string;
  deviceId: string;
  lastSeen: Date;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoricalDataRequest {
  timeRange: '1d' | '1m' | '3m' | '6m' | '1y';
  deviceId?: string;
}

export interface ChartDataPoint {
  timestamp: string;
  temperature: number;
  humidity: number;
  date: string;
  time: string;
}

export type TimeGranularity = '1d' | '1m' | '3m' | '6m' | '1y';

export interface MqttMessage {
  temperature: number;
  humidity: number;
  timestamp?: string;
  deviceId?: string;
}

export interface WebSocketMessage {
  type: 'sensor_update' | 'device_status' | 'error';
  data: SensorReading | DeviceStatus | string;
}
