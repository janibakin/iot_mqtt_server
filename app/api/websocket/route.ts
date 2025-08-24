
import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { mqttService } from '@/lib/mqtt-client';

let wss: WebSocketServer | null = null;

export async function GET(request: NextRequest) {
  // In a production environment, you'd typically upgrade the HTTP connection to WebSocket
  // For this demo, we'll return connection info and let the client connect directly
  
  try {
    if (!wss) {
      const PORT = process.env.WS_PORT || 8080;
      wss = new WebSocketServer({ port: Number(PORT) });
      
      wss.on('connection', (ws: WebSocket) => {
        console.log('New WebSocket connection');
        
        // Add client to MQTT service for broadcasting
        mqttService.addWebSocketClient(ws);
        
        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connection',
          data: 'Connected to IoT monitoring server',
          timestamp: new Date().toISOString(),
        }));
        
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            console.log('Received WebSocket message:', data);
            
            // Handle ping/pong or other client messages
            if (data.type === 'ping') {
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              }));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });
        
        ws.on('close', () => {
          console.log('WebSocket connection closed');
          mqttService.removeWebSocketClient(ws);
        });
        
        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          mqttService.removeWebSocketClient(ws);
        });
      });
      
      console.log(`WebSocket server started on port ${PORT}`);
    }
    
    return new Response(JSON.stringify({
      message: 'WebSocket server running',
      port: process.env.WS_PORT || 8080,
      endpoint: `ws://localhost:${process.env.WS_PORT || 8080}`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error setting up WebSocket:', error);
    return new Response(JSON.stringify({
      error: 'Failed to setup WebSocket server',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
