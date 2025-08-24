
import { NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || 'esp32-01';

    const [currentReading, deviceStatus, averages] = await Promise.all([
      DataService.getCurrentReading(deviceId),
      DataService.getDeviceStatus(deviceId),
      DataService.getAverageReadings(24, deviceId),
    ]);

    if (!currentReading) {
      return NextResponse.json(
        { error: 'No sensor readings found', deviceId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      current: {
        temperature: currentReading.temperature,
        humidity: currentReading.humidity,
        timestamp: currentReading.timestamp,
        deviceId: currentReading.deviceId,
      },
      device: {
        isOnline: deviceStatus?.isOnline || false,
        lastSeen: deviceStatus?.lastSeen || null,
      },
      averages: {
        temperature: Number(averages.avgTemperature.toFixed(1)),
        humidity: Number(averages.avgHumidity.toFixed(1)),
        readingCount: averages.readingCount,
      },
    });
  } catch (error) {
    console.error('Error fetching current data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current sensor data' },
      { status: 500 }
    );
  }
}
