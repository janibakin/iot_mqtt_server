
class TelemetryDashboard {
    constructor() {
        this.temperatureChart = null;
        this.humidityChart = null;
        this.currentDevice = '';
        this.currentRange = '1d';
        this.isLoading = false;

        this.initializeElements();
        this.initializeCharts();
        this.bindEvents();
        this.loadDevices();
        this.checkHealth();

        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshData(), 30000);
    }

    initializeElements() {
        this.deviceSelect = document.getElementById('deviceSelect');
        this.rangeSelect = document.getElementById('rangeSelect');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.lastUpdated = document.getElementById('lastUpdated');
        this.dataPoints = document.getElementById('dataPoints');
    }

    initializeCharts() {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'MMM dd HH:mm',
                            day: 'MMM dd',
                            week: 'MMM dd',
                            month: 'MMM YYYY'
                        }
                    },
                    ticks: {
                        maxTicksLimit: 8
                    }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        maxTicksLimit: 6
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function (context) {
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleString();
                        }
                    }
                }
            },
            elements: {
                point: {
                    radius: 2,
                    hoverRadius: 4
                }
            }
        };

        // Temperature chart
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.temperatureChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Temperature (°C)',
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                plugins: {
                    ...commonOptions.plugins,
                    tooltip: {
                        ...commonOptions.plugins.tooltip,
                        callbacks: {
                            ...commonOptions.plugins.tooltip.callbacks,
                            label: function (context) {
                                return `Temperature: ${context.parsed.y.toFixed(1)}°C`;
                            }
                        }
                    }
                }
            }
        });

        // Humidity chart
        const humCtx = document.getElementById('humidityChart').getContext('2d');
        this.humidityChart = new Chart(humCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Humidity (%)',
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                plugins: {
                    ...commonOptions.plugins,
                    tooltip: {
                        ...commonOptions.plugins.tooltip,
                        callbacks: {
                            ...commonOptions.plugins.tooltip.callbacks,
                            label: function (context) {
                                return `Humidity: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    bindEvents() {
        this.deviceSelect.addEventListener('change', (e) => {
            this.currentDevice = e.target.value;
            if (this.currentDevice) {
                this.loadReadings();
            }
        });

        this.rangeSelect.addEventListener('change', (e) => {
            this.currentRange = e.target.value;
            if (this.currentDevice) {
                this.loadReadings();
            }
        });

        this.refreshBtn.addEventListener('click', () => {
            this.refreshData();
        });
    }

    async loadDevices() {
        try {
            this.setStatus('connecting', 'Loading devices...');
            const response = await fetch('/api/devices');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                this.deviceSelect.innerHTML = '<option value="">Select a device...</option>';

                if (result.data.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No devices found';
                    option.disabled = true;
                    this.deviceSelect.appendChild(option);
                    this.setStatus('error', 'No devices available');
                    return;
                }

                result.data.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device;
                    option.textContent = device;
                    this.deviceSelect.appendChild(option);
                });

                // Auto-select first device if available
                this.deviceSelect.value = result.data[0];
                this.currentDevice = result.data[0];
                this.loadReadings();

            } else {
                throw new Error(result.error || 'Invalid response format');
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
            this.setStatus('error', `Failed to load devices: ${error.message}`);
            this.showError('Could not load device list. Please check your connection and try refreshing the page.');
        }
    }

    async loadReadings() {
        if (!this.currentDevice) return;

        if (this.isLoading) return; // Prevent concurrent requests

        this.isLoading = true;
        this.refreshBtn.disabled = true;
        this.refreshBtn.textContent = 'Loading...';
        this.setStatus('connecting', 'Loading data...');
        this.showChartLoading(true);

        try {
            const response = await fetch(`/api/readings?device_id=${encodeURIComponent(this.currentDevice)}&range=${this.currentRange}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                if (result.data.length === 0) {
                    this.setStatus('connected', 'Connected - No data available');
                    this.showError('No data available for the selected device and time range.');
                    this.clearCharts();
                } else {
                    this.updateCharts(result.data);
                    this.updateInfo(result.data);
                    this.setStatus('connected', 'Connected');
                    this.hideError();
                }
            } else {
                throw new Error(result.error || 'Invalid response format');
            }
        } catch (error) {
            console.error('Failed to load readings:', error);
            this.setStatus('error', `Failed to load data: ${error.message}`);
            this.showError(`Could not load readings for device "${this.currentDevice}". Please try again.`);
            this.clearCharts();
        } finally {
            this.isLoading = false;
            this.refreshBtn.disabled = false;
            this.refreshBtn.textContent = 'Refresh';
            this.showChartLoading(false);
        }
    }

    updateCharts(readings) {
        try {
            // Process temperature data
            const temperatureData = readings
                .filter(r => r && r.avg_temperature_c !== null && r.avg_temperature_c !== undefined)
                .map(r => {
                    const timestamp = new Date(r.ts);
                    if (isNaN(timestamp.getTime())) {
                        console.warn('Invalid timestamp:', r.ts);
                        return null;
                    }
                    return {
                        x: timestamp,
                        y: parseFloat(r.avg_temperature_c)
                    };
                })
                .filter(point => point !== null);

            // Process humidity data
            const humidityData = readings
                .filter(r => r && r.avg_humidity_pct !== null && r.avg_humidity_pct !== undefined)
                .map(r => {
                    const timestamp = new Date(r.ts);
                    if (isNaN(timestamp.getTime())) {
                        console.warn('Invalid timestamp:', r.ts);
                        return null;
                    }
                    return {
                        x: timestamp,
                        y: parseFloat(r.avg_humidity_pct)
                    };
                })
                .filter(point => point !== null);

            // Update charts
            this.temperatureChart.data.datasets[0].data = temperatureData;
            this.humidityChart.data.datasets[0].data = humidityData;

            // Set appropriate y-axis range for temperature
            if (temperatureData.length > 0) {
                const temps = temperatureData.map(d => d.y);
                const minTemp = Math.min(...temps);
                const maxTemp = Math.max(...temps);
                const padding = (maxTemp - minTemp) * 0.1 || 5; // 10% padding or 5 degrees minimum

                this.temperatureChart.options.scales.y.min = Math.floor(minTemp - padding);
                this.temperatureChart.options.scales.y.max = Math.ceil(maxTemp + padding);
            }

            // Animate chart updates
            this.temperatureChart.update('active');
            this.humidityChart.update('active');

        } catch (error) {
            console.error('Failed to update charts:', error);
            this.showError('Failed to display chart data. Please try refreshing.');
        }
    }

    updateInfo(readings) {
        this.lastUpdated.textContent = new Date().toLocaleString();
        this.dataPoints.textContent = readings.length.toLocaleString();
    }

    async checkHealth() {
        try {
            const response = await fetch('/api/health');
            const result = await response.json();

            if (result.success) {
                this.setStatus('connected', 'Connected');
            } else {
                this.setStatus('error', 'Service unhealthy');
            }
        } catch (error) {
            this.setStatus('error', 'Connection failed');
        }
    }

    setStatus(type, text) {
        // Handle connecting state as a special case
        if (type === 'connecting') {
            this.statusIndicator.className = 'status-indicator connecting';
        } else {
            this.statusIndicator.className = `status-indicator ${type}`;
        }
        this.statusText.textContent = text;
    }

    refreshData() {
        this.loadDevices();
        if (this.currentDevice) {
            this.loadReadings();
        }
        this.checkHealth();
    }

    // Utility methods for UI feedback
    showError(message) {
        this.hideError(); // Remove any existing error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.id = 'error-message';
        errorDiv.textContent = message;

        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.querySelector('.charts-container'));
    }

    hideError() {
        const existingError = document.getElementById('error-message');
        if (existingError) {
            existingError.remove();
        }
    }

    showChartLoading(show) {
        const chartWrappers = document.querySelectorAll('.chart-wrapper');
        chartWrappers.forEach(wrapper => {
            let loadingDiv = wrapper.querySelector('.loading');

            if (show) {
                if (!loadingDiv) {
                    loadingDiv = document.createElement('div');
                    loadingDiv.className = 'loading';
                    loadingDiv.innerHTML = '<div>Loading chart data...</div>';
                    wrapper.appendChild(loadingDiv);
                }
                loadingDiv.style.display = 'flex';
                wrapper.querySelector('canvas').style.display = 'none';
            } else {
                if (loadingDiv) {
                    loadingDiv.style.display = 'none';
                }
                wrapper.querySelector('canvas').style.display = 'block';
            }
        });
    }

    clearCharts() {
        try {
            this.temperatureChart.data.datasets[0].data = [];
            this.humidityChart.data.datasets[0].data = [];
            this.temperatureChart.update('none');
            this.humidityChart.update('none');
        } catch (error) {
            console.error('Failed to clear charts:', error);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TelemetryDashboard();
});
