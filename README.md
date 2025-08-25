
# IoT MQTT Telemetry Server

A complete Rust-based IoT telemetry server designed for Raspberry Pi that ingests MQTT messages from ESP32 devices, stores them in PostgreSQL, and provides a web dashboard for visualization.

## Features

- **MQTT Ingestion**: Subscribes to sensor telemetry from ESP32 devices
- **PostgreSQL Storage**: Efficient time-series data storage with automatic cleanup
- **Web Dashboard**: Clean, responsive interface with Chart.js visualizations
- **REST API**: JSON endpoints for device management and data retrieval
- **Time Aggregation**: Multiple time ranges (1d, 1w, 1m, 6m, 1y) with appropriate bucketing
- **Auto-reconnection**: Robust error handling and automatic reconnection for MQTT
- **Data Retention**: Automatic cleanup of data older than 1 year

## Architecture

- **Async Rust**: Built with Tokio for high-performance async operations
- **MQTT Client**: Uses rumqttc for reliable MQTT communication
- **Web Server**: Axum-based HTTP server with static file serving
- **Database**: SQLx for type-safe PostgreSQL operations
- **Frontend**: Vanilla JavaScript with Chart.js for visualizations

## Prerequisites

### System Requirements
- Raspberry Pi (3B+ or newer recommended)
- Rust 1.70+ (installed via rustup)
- PostgreSQL 12+
- MQTT Broker (Mosquitto recommended)

### Installation on Raspberry Pi

1. **Install Rust**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Install PostgreSQL**:
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

3. **Install MQTT Broker**:
   ```bash
   sudo apt install mosquitto mosquitto-clients
   sudo systemctl start mosquitto
   sudo systemctl enable mosquitto
   ```

4. **Setup Database**:
   ```bash
   sudo -u postgres createuser -P pi  # Enter password when prompted
   sudo -u postgres createdb -O pi telemetry
   ```

## Setup

1. **Clone and build the project**:
   ```bash
   git clone <repository-url>
   cd iot_mqtt_server
   cargo build --release
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your specific configuration
   ```

3. **Run database migrations**:
   ```bash
   # Migrations run automatically on startup, but you can also run manually:
   cargo install sqlx-cli --no-default-features --features postgres
   sqlx migrate run
   ```

4. **Start the server**:
   ```bash
   cargo run --release
   ```

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ADDR` | `0.0.0.0:8080` | Web server bind address |
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | MQTT broker connection URL |
| `MQTT_CLIENT_ID` | `pi-telemetry` | MQTT client identifier |
| `MQTT_TOPIC_FILTER` | `sensors/+/telemetry` | MQTT topic subscription pattern |
| `PG_URL` | `postgres://pi:password@localhost:5432/telemetry` | PostgreSQL connection string |
| `LOG_LEVEL` | `info` | Logging level (trace, debug, info, warn, error) |

## MQTT Message Format

ESP32 devices should publish JSON messages to `sensors/{device_id}/telemetry`:

```json
{
  "temperature_c": 24.3,
  "humidity_pct": 40.2,
  "ts": "2025-08-25T12:00:00Z"
}
```

- `temperature_c`: Temperature in Celsius (optional)
- `humidity_pct`: Humidity percentage (optional)
- `ts`: ISO 8601 timestamp (optional, defaults to server time)

## API Endpoints

### GET /api/devices
Returns list of all device IDs that have sent data.

**Response**:
```json
{
  "success": true,
  "data": ["esp32-01", "esp32-02"]
}
```

### GET /api/readings
Retrieve aggregated sensor readings for a device.

**Parameters**:
- `device_id` (required): Device identifier
- `range` (optional): Time range - `1d`, `1w`, `1m`, `6m`, `1y` (default: `1d`)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "ts": "2025-08-25T12:00:00Z",
      "avg_temperature_c": 24.3,
      "avg_humidity_pct": 40.2
    }
  ]
}
```

### GET /api/health
Health check endpoint.

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-25T12:00:00Z"
  }
}
```

## Time Aggregation

Data is automatically aggregated based on the requested time range:

| Range | Interval | Bucket Size |
|-------|----------|-------------|
| 1d | Last 24 hours | 5 minutes |
| 1w | Last 7 days | 1 hour |
| 1m | Last 30 days | 6 hours |
| 6m | Last 180 days | 1 day |
| 1y | Last 365 days | 1 week |

## Web Dashboard

Access the dashboard at `http://your-pi-ip:8080`. Features include:

- Device selection dropdown
- Time range selection (1 day to 1 year)
- Real-time temperature and humidity charts
- Connection status indicator
- Auto-refresh every 30 seconds

## Running as a Service

Create a systemd service file `/etc/systemd/system/iot-telemetry.service`:

```ini
[Unit]
Description=IoT MQTT Telemetry Server
After=network.target postgresql.service mosquitto.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/iot_mqtt_server
ExecStart=/home/pi/iot_mqtt_server/target/release/iot_mqtt_server
Restart=always
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable iot-telemetry
sudo systemctl start iot-telemetry
```

## ESP32 Example Code

Here's a simple Arduino sketch for ESP32 to send telemetry:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

const char* ssid = "your-wifi-ssid";
const char* password = "your-wifi-password";
const char* mqtt_server = "your-pi-ip";
const char* device_id = "esp32-01";

DHT dht(2, DHT22);
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (!isnan(temp) && !isnan(humidity)) {
    StaticJsonDocument<200> doc;
    doc["temperature_c"] = temp;
    doc["humidity_pct"] = humidity;
    doc["ts"] = WiFi.getTime(); // You may need to format this properly
    
    String payload;
    serializeJson(doc, payload);
    
    String topic = "sensors/" + String(device_id) + "/telemetry";
    client.publish(topic.c_str(), payload.c_str());
  }
  
  delay(30000); // Send every 30 seconds
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect(device_id)) {
      Serial.println("MQTT connected");
    } else {
      delay(5000);
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Database connection failed**: Ensure PostgreSQL is running and credentials are correct
2. **MQTT connection failed**: Check if Mosquitto broker is running on port 1883
3. **Permission denied**: Ensure the user has read/write access to the project directory
4. **Port already in use**: Change `APP_ADDR` to use a different port

### Logs

View application logs:
```bash
# If running directly
RUST_LOG=debug cargo run

# If running as service
sudo journalctl -u iot-telemetry -f
```

### Database Queries

Check data directly:
```sql
-- Connect to database
psql -U pi -d telemetry

-- View recent readings
SELECT * FROM readings ORDER BY ts DESC LIMIT 10;

-- Check device count
SELECT device_id, COUNT(*) FROM readings GROUP BY device_id;
```

## License

MIT License - see LICENSE file for details.
