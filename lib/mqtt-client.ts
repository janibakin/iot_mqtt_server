
import mqtt, { MqttClient } from 'mqtt';
import { prisma } from './db';
import type { MqttMessage, WebSocketMessage } from './types';

class MqttService {
  private client: MqttClient | null = null;
  private isConnected = false;
  private wsClients: Set<any> = new Set();
  
  async connect() {
    if (this.client) {
      return;
    }

    const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    const MQTT_TOPIC = process.env.MQTT_TOPIC || 'sensor/data';
    
    console.log(`Connecting to MQTT broker: ${MQTT_BROKER}`);
    console.log(`Subscribing to topic: ${MQTT_TOPIC}`);
    
    this.client = mqtt.connect(MQTT_BROKER, {
      clientId: `iot_server_${Math.random().toString(16).substr(2, 8)}`,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    });

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.isConnected = true;
      
      this.client?.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
          console.error('Failed to subscribe to topic:', err);
        } else {
          console.log(`Successfully subscribed to ${MQTT_TOPIC}`);
        }
      });
    });

    this.client.on('message', async (topic, message) => {
      await this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error);
      this.isConnected = false;
    });

    this.client.on('offline', () => {
      console.log('MQTT client offline');
      this.isConnected = false;
    });

    this.client.on('reconnect', () => {
      console.log('MQTT client reconnecting...');
    });
  }

  private async handleMessage(topic: string, message: Buffer) {
    try {
      const data: MqttMessage = JSON.parse(message.toString());
      
      // Validate required fields
      if (typeof data.temperature !== 'number' || typeof data.humidity !== 'number') {
        console.error('Invalid sensor data format:', data);
        return;
      }

      const deviceId = data.deviceId || 'esp32-01';
      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

      // Save to database
      const sensorReading = await prisma.sensorReading.create({
        data: {
          deviceId,
          temperature: data.temperature,
          humidity: data.humidity,
          timestamp,
        },
      });

      // Update device status
      await prisma.deviceStatus.upsert({
        where: { deviceId },
        update: {
          lastSeen: new Date(),
          isOnline: true,
        },
        create: {
          deviceId,
          lastSeen: new Date(),
          isOnline: true,
        },
      });

      console.log(`Saved sensor reading: T=${data.temperature}°C, H=${data.humidity}%`);

      // Broadcast to WebSocket clients
      this.broadcastToClients({
        type: 'sensor_update',
        data: sensorReading,
      });
      
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  }

  addWebSocketClient(client: any) {
    this.wsClients.add(client);
    console.log(`WebSocket client added. Total clients: ${this.wsClients.size}`);
  }

  removeWebSocketClient(client: any) {
    this.wsClients.delete(client);
    console.log(`WebSocket client removed. Total clients: ${this.wsClients.size}`);
  }

  private broadcastToClients(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    this.wsClients.forEach((client) => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(messageStr);
        }
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.wsClients.delete(client);
      }
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const mqttService = new MqttService();
