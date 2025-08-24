
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.sensorReading.deleteMany();
  await prisma.deviceStatus.deleteMany();
  
  console.log('🗑️  Cleared existing data');

  const deviceId = 'esp32-01';
  const now = new Date();
  
  // Create device status
  await prisma.deviceStatus.create({
    data: {
      deviceId,
      lastSeen: now,
      isOnline: true,
    },
  });

  console.log('📱 Created device status');

  // Generate sample sensor readings for the past 7 days
  const readings = [];
  const daysToGenerate = 7;
  const readingsPerDay = 48; // Every 30 minutes

  for (let day = 0; day < daysToGenerate; day++) {
    for (let reading = 0; reading < readingsPerDay; reading++) {
      const timestamp = new Date(
        now.getTime() - 
        (day * 24 * 60 * 60 * 1000) - 
        (reading * 30 * 60 * 1000) // 30 minutes apart
      );

      // Generate realistic temperature and humidity data
      const baseTemp = 22; // Base temperature around 22°C
      const tempVariation = Math.sin((day * 24 + reading * 0.5) * Math.PI / 12) * 5; // Daily cycle
      const randomTempNoise = (Math.random() - 0.5) * 2;
      const temperature = baseTemp + tempVariation + randomTempNoise;

      const baseHumidity = 60; // Base humidity around 60%
      const humidityVariation = Math.sin((day * 24 + reading * 0.5 + 6) * Math.PI / 12) * 10; // Inverse of temperature
      const randomHumidityNoise = (Math.random() - 0.5) * 5;
      const humidity = Math.max(30, Math.min(90, baseHumidity - humidityVariation + randomHumidityNoise));

      readings.push({
        deviceId,
        temperature: Number(temperature.toFixed(1)),
        humidity: Number(humidity.toFixed(1)),
        timestamp,
      });
    }
  }

  // Batch insert readings
  await prisma.sensorReading.createMany({
    data: readings,
  });

  console.log(`📊 Created ${readings.length} sensor readings`);
  console.log(`📅 Data spans from ${readings[readings.length - 1].timestamp.toISOString()} to ${readings[0].timestamp.toISOString()}`);
  
  // Show some sample data
  const latestReading = await prisma.sensorReading.findFirst({
    orderBy: { timestamp: 'desc' },
  });

  if (latestReading) {
    console.log(`🌡️  Latest reading: ${latestReading.temperature}°C, ${latestReading.humidity}% at ${latestReading.timestamp.toISOString()}`);
  }

  const totalReadings = await prisma.sensorReading.count();
  console.log(`📈 Total readings in database: ${totalReadings}`);

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
