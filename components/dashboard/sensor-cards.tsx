
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Droplets, Activity, Wifi, WifiOff } from 'lucide-react';
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

interface SensorCardsProps {
  data: SensorData | null;
  isLoading: boolean;
}

export function SensorCards({ data, isLoading }: SensorCardsProps) {
  const [animatedTemp, setAnimatedTemp] = useState(0);
  const [animatedHumidity, setAnimatedHumidity] = useState(0);

  useEffect(() => {
    if (data?.current) {
      const tempTarget = data.current.temperature;
      const humidityTarget = data.current.humidity;
      
      const tempStep = tempTarget / 50;
      const humidityStep = humidityTarget / 50;
      
      let tempCurrent = 0;
      let humidityCurrent = 0;
      
      const interval = setInterval(() => {
        tempCurrent += tempStep;
        humidityCurrent += humidityStep;
        
        if (tempCurrent >= tempTarget && humidityCurrent >= humidityTarget) {
          setAnimatedTemp(tempTarget);
          setAnimatedHumidity(humidityTarget);
          clearInterval(interval);
        } else {
          setAnimatedTemp(Math.min(tempCurrent, tempTarget));
          setAnimatedHumidity(Math.min(humidityCurrent, humidityTarget));
        }
      }, 20);
      
      return () => clearInterval(interval);
    }
  }, [data?.current]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-500 py-8">
        No sensor data available. Check your MQTT connection.
      </div>
    );
  }

  const getTemperatureColor = (temp: number) => {
    if (temp > 30) return 'text-red-600';
    if (temp > 20) return 'text-orange-500';
    if (temp > 10) return 'text-yellow-500';
    return 'text-blue-500';
  };

  const getHumidityColor = (humidity: number) => {
    if (humidity > 70) return 'text-blue-600';
    if (humidity > 50) return 'text-blue-500';
    if (humidity > 30) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getTemperatureColor(data.current.temperature)}`}>
              {animatedTemp.toFixed(1)}°C
            </div>
            <p className="text-xs text-muted-foreground">
              24h avg: {data.averages.temperature.toFixed(1)}°C
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Humidity</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHumidityColor(data.current.humidity)}`}>
              {animatedHumidity.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              24h avg: {data.averages.humidity.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Device Status</CardTitle>
            {data.device.isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={data.device.isOnline ? "default" : "destructive"}>
                {data.device.isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.device.lastSeen ? 
                `Last seen: ${new Date(data.device.lastSeen).toLocaleTimeString()}` :
                'Never connected'
              }
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Readings</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.averages.readingCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
