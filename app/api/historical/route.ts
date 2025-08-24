
import { NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';
import type { TimeGranularity } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get('timeRange') as TimeGranularity) || '1d';
    const deviceId = searchParams.get('deviceId') || 'esp32-01';

    if (!['1d', '1m', '3m', '6m', '1y'].includes(timeRange)) {
      return NextResponse.json(
        { error: 'Invalid time range. Must be one of: 1d, 1m, 3m, 6m, 1y' },
        { status: 400 }
      );
    }

    const data = await DataService.getHistoricalData(timeRange, deviceId);

    return NextResponse.json({
      timeRange,
      deviceId,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}
