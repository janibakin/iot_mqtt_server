
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { WebSocketProvider } from '@/components/dashboard/websocket-provider';

export default function Home() {
  return (
    <WebSocketProvider>
      <DashboardLayout />
    </WebSocketProvider>
  );
}
