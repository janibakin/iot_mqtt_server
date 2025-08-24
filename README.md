
# IoT MQTT Monitoring Dashboard

A complete IoT monitoring web application that receives temperature and humidity data from ESP32 sensors via MQTT and displays real-time dashboards with historical charts.

## Features

- 🌡️ **Real-time Monitoring**: Live temperature and humidity displays with auto-refresh
- 📊 **Historical Charts**: Interactive time-series charts with multiple time granularities (1 day to 1 year)
- 🔗 **MQTT Integration**: Receives sensor data via MQTT protocol
- ⚡ **WebSocket Updates**: Real-time dashboard updates without page refresh
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 💾 **PostgreSQL Storage**: Efficient time-series data storage with proper indexing
- 🔧 **Device Status**: Monitor ESP32 device connectivity and health

## Architecture

- **Frontend**: Next.js 14 with React 18, Tailwind CSS, Framer Motion
- **Backend**: Next.js API routes with MQTT client integration
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSocket connections for live updates
- **Charts**: Recharts for responsive data visualization

## Prerequisites

### Raspberry Pi Setup

1. **Install Node.js 18+**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install PostgreSQL**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y postgresql postgresql-contrib
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

3. **Install Mosquitto MQTT Broker**:
   ```bash
   sudo apt-get install -y mosquitto mosquitto-clients
   sudo systemctl start mosquitto
   sudo systemctl enable mosquitto
   ```

### MQTT Broker Configuration

1. **Configure Mosquitto** (optional - default settings work for local development):
   ```bash
   sudo nano /etc/mosquitto/mosquitto.conf
   ```

   Add these lines for basic configuration:
   ```
   listener 1883 0.0.0.0
   allow_anonymous true
   ```

2. **Restart Mosquitto**:
   ```bash
   sudo systemctl restart mosquitto
   ```

3. **Test MQTT Broker**:
   ```bash
   # Subscribe to test topic
   mosquitto_sub -h localhost -t "sensor/data"
   
   # In another terminal, publish test message
   mosquitto_pub -h localhost -t "sensor/data" -m '{"temperature": 25.5, "humidity": 60.2}'
   ```

## Installation

1. **Clone and Install**:
   ```bash
   cd /path/to/iot_mqtt_server/app
   yarn install
   ```

2. **Database Setup**:
   ```bash
   # Copy environment variables
   cp .env.example .env
   
   # Edit .env with your database URL
   nano .env
   
   # Generate Prisma client and push schema
   yarn prisma generate
   yarn prisma db push
   
   # Optional: Seed with sample data
   yarn prisma db seed
   ```

3. **Environment Variables** (update `.env`):
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/iot_monitoring"
   MQTT_BROKER_URL="mqtt://localhost:1883"
   MQTT_TOPIC="sensor/data"
   WS_PORT=8080
   ```

## Running the Application

1. **Start the Application**:
   ```bash
   cd /path/to/iot_mqtt_server/app
   yarn dev
   ```

2. **Access Dashboard**:
   Open http://localhost:3000 in your browser

3. **Monitor Logs**:
   ```bash
   # Check MQTT connections and sensor data reception
   tail -f ~/.pm2/logs/iot-dashboard-out.log
   ```

## ESP32 Configuration

### Arduino Code Example

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "your-wifi-ssid";
const char* password = "your-wifi-password";

// MQTT Configuration
const char* mqtt_server = "192.168.1.100"; // Raspberry Pi IP
const int mqtt_port = 1883;
const char* mqtt_topic = "sensor/data";

// DHT Sensor Configuration
#define DHT_PIN 2
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
  
  // Configure MQTT
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Read sensor data
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (!isnan(temperature) && !isnan(humidity)) {
    // Create JSON message
    StaticJsonDocument<200> doc;
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;
    doc["timestamp"] = WiFi.getTime();
    doc["deviceId"] = "esp32-01";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Publish to MQTT
    client.publish(mqtt_topic, jsonString.c_str());
    Serial.println("Data sent: " + jsonString);
  }
  
  delay(30000); // Send every 30 seconds
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP32Client")) {
      Serial.println("MQTT connected");
    } else {
      delay(5000);
    }
  }
}
```

### Required Libraries

Install these libraries in Arduino IDE:
- WiFi (ESP32 Core)
- PubSubClient by Nick O'Leary
- DHT sensor library by Adafruit
- ArduinoJson by Benoit Blanchon

## API Endpoints

- `GET /api/current` - Get latest sensor readings and device status
- `GET /api/historical?timeRange=1d&deviceId=esp32-01` - Get historical data
- `GET /api/mqtt` - Check MQTT broker connection status
- `GET /api/websocket` - WebSocket connection info

## Time Granularities

- `1d` - Last 24 hours (hourly averages)
- `1m` - Last month (daily averages)
- `3m` - Last 3 months (daily averages)
- `6m` - Last 6 months (weekly averages)
- `1y` - Last year (monthly averages)

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Build application
yarn build

# Start with PM2
pm2 start npm --name "iot-dashboard" -- start

# Setup auto-restart on boot
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000 8080
CMD ["npm", "start"]
```

## Monitoring & Maintenance

### Database Maintenance

```bash
# Check database size
yarn prisma db execute --command "SELECT pg_size_pretty(pg_database_size('your_db_name'))"

# Clean old data (keep last 3 months)
yarn prisma db execute --command "DELETE FROM sensor_readings WHERE timestamp < NOW() - INTERVAL '3 months'"

# Analyze table performance
yarn prisma db execute --command "ANALYZE sensor_readings"
```

### MQTT Monitoring

```bash
# Monitor MQTT traffic
mosquitto_sub -v -t '#'

# Check specific device topic
mosquitto_sub -t 'sensor/data'

# Test MQTT broker status
systemctl status mosquitto
```

## Troubleshooting

### Common Issues

1. **MQTT Connection Failed**:
   - Check if Mosquitto is running: `sudo systemctl status mosquitto`
   - Verify firewall settings: `sudo ufw allow 1883`
   - Check broker URL in environment variables

2. **Database Connection Error**:
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check DATABASE_URL in .env file
   - Run: `yarn prisma db push`

3. **WebSocket Connection Failed**:
   - Ensure WS_PORT (default 8080) is available
   - Check firewall settings: `sudo ufw allow 8080`
   - Verify no other services using the port

4. **ESP32 Not Sending Data**:
   - Check WiFi connection on ESP32
   - Verify MQTT server IP address
   - Monitor Serial output for error messages
   - Check DHT sensor wiring

### Logs and Debugging

```bash
# Application logs
tail -f ~/.pm2/logs/iot-dashboard-out.log
tail -f ~/.pm2/logs/iot-dashboard-error.log

# MQTT broker logs
sudo journalctl -u mosquitto -f

# PostgreSQL logs
sudo journalctl -u postgresql -f
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review application logs
- Create an issue with detailed information about your setup
