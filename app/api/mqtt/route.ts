
import { NextResponse } from 'next/server';
import { mqttService } from '@/lib/mqtt-client';

export const dynamic = 'force-dynamic';

// MQTT connection will be initialized on first API call, not automatically

export async function GET() {
  try {
    const isConnected = mqttService.getConnectionStatus();
    
    return NextResponse.json({
      mqtt: {
        connected: isConnected,
        broker: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
        topic: process.env.MQTT_TOPIC || 'sensor/data',
      },
      status: isConnected ? 'Connected' : 'Disconnected',
    });
  } catch (error) {
    console.error('Error checking MQTT status:', error);
    return NextResponse.json(
      { error: 'Failed to get MQTT status' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    await mqttService.connect();
    
    return NextResponse.json({
      message: 'MQTT connection initiated',
      status: 'connecting',
    });
  } catch (error) {
    console.error('Error connecting to MQTT:', error);
    return NextResponse.json(
      { error: 'Failed to connect to MQTT broker' },
      { status: 500 }
    );
  }
}
