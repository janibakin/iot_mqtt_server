
'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ChartDataPoint, TimeGranularity } from '@/lib/types';

interface HistoricalChartProps {
  deviceId?: string;
}

const TIME_RANGES: { value: TimeGranularity; label: string }[] = [
  { value: '1d', label: '1 Day' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
];

export function HistoricalChart({ deviceId = 'esp32-01' }: HistoricalChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<TimeGranularity>('1d');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHistoricalData = async (timeRange: TimeGranularity) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/historical?timeRange=${timeRange}&deviceId=${deviceId}`
      );
      
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
        setLastUpdated(new Date());
      } else {
        console.error('Failed to fetch historical data');
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData(selectedRange);
  }, [selectedRange, deviceId]);

  const handleRangeChange = (range: TimeGranularity) => {
    setSelectedRange(range);
  };

  const handleRefresh = () => {
    fetchHistoricalData(selectedRange);
  };

  const formatXAxisTick = (tickItem: string) => {
    const date = new Date(tickItem);
    
    switch (selectedRange) {
      case '1d':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '1m':
      case '3m':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case '6m':
      case '1y':
        return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleDateString();
    }
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-1">
            {date.toLocaleDateString()} at {date.toLocaleTimeString()}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'Temperature' ? '°C' : '%'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Historical Data</span>
            </CardTitle>
            <CardDescription>
              Temperature and humidity trends over time
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {lastUpdated && (
              <Badge variant="outline" className="text-xs">
                Updated {lastUpdated.toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={selectedRange === range.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleRangeChange(range.value)}
              disabled={loading}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-gray-600">Loading chart data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No data available for the selected time range</p>
              <p className="text-sm text-gray-400 mt-1">
                Check your MQTT connection and ensure sensors are sending data
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-[400px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatXAxisTick}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="temp"
                  orientation="left"
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: 'Temperature (°C)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: 11 }
                  }}
                />
                <YAxis
                  yAxisId="humidity"
                  orientation="right"
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  label={{
                    value: 'Humidity (%)',
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fontSize: 11 }
                  }}
                />
                <Tooltip content={customTooltip} wrapperStyle={{ fontSize: 11 }} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="Temperature"
                  connectNulls
                />
                <Line
                  yAxisId="humidity"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Humidity"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
