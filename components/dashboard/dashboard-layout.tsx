
'use client';

import { useState, useEffect } from 'react';
import { SensorCards } from './sensor-cards';
import { HistoricalChart } from '../charts/historical-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from './websocket-provider';
import { RefreshCw, Server, Wifi, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface SensorData {
  current: {
    temperature: number;
    humidity: number;
    timestamp: string;
    deviceId: string;
  };
  device: {
    isOnline: boolean;
    lastSeen: string | null;
  };
  averages: {
    temperature: number;
    humidity: number;
    readingCount: number;
  };
}

export function DashboardLayout() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mqttStatus, setMqttStatus] = useState<{ connected: boolean; broker: string; topic: string } | null>(null);
  
  const { isConnected: wsConnected, lastMessage, connectionStatus } = useWebSocket();

  // Fetch current sensor data
  const fetchCurrentData = async () => {
    try {
      const response = await fetch('/api/current');
      if (response.ok) {
        const data = await response.json();
        setSensorData(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching current data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch MQTT status
  const fetchMqttStatus = async () => {
    try {
      const response = await fetch('/api/mqtt');
      if (response.ok) {
        const data = await response.json();
        setMqttStatus(data.mqtt);
      }
    } catch (error) {
      console.error('Error fetching MQTT status:', error);
    }
  };

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'sensor_update') {
      fetchCurrentData(); // Refresh data when new sensor reading arrives
    }
  }, [lastMessage]);

  // Initial data fetch
  useEffect(() => {
    fetchCurrentData();
    fetchMqttStatus();
    
    // Set up periodic refresh as fallback
    const interval = setInterval(fetchCurrentData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                IoT Sensor <span className="text-blue-600">Monitoring</span>
              </h1>
              <p className="text-gray-600">
                Real-time temperature and humidity monitoring dashboard
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchCurrentData();
                  fetchMqttStatus();
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {/* MQTT Status */}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${mqttStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium">MQTT</span>
                  <Badge variant={mqttStatus?.connected ? "default" : "destructive"}>
                    {mqttStatus?.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>

                {/* WebSocket Status */}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(connectionStatus)}`}></div>
                  <span className="text-sm font-medium">WebSocket</span>
                  <Badge 
                    variant={wsConnected ? "default" : connectionStatus === 'connecting' ? "secondary" : "destructive"}
                  >
                    {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                  </Badge>
                </div>

                {/* Last Update */}
                {lastUpdated && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>Last updated:</span>
                    <span className="font-mono">{lastUpdated.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              {mqttStatus && (
                <div className="mt-3 text-xs text-gray-500">
                  <div>Broker: {mqttStatus.broker}</div>
                  <div>Topic: {mqttStatus.topic}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sensor Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <SensorCards data={sensorData} isLoading={loading} />
        </motion.div>

        {/* Historical Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <HistoricalChart deviceId="esp32-01" />
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 text-center text-sm text-gray-500"
        >
          <p>IoT Monitoring Dashboard - Real-time sensor data visualization</p>
        </motion.div>
      </div>
    </div>
  );
}
