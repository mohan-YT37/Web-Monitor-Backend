
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
  namespace: '/monitors',
})
export class MonitorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private clientSubscriptions: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket) {
    this.clientSubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.clientSubscriptions.delete(client.id);
  }

  @SubscribeMessage('subscribe-monitor')
  handleSubscribeMonitor(client: Socket, publicId: string) {
    const room = `monitor-${publicId}`;
    client.join(room);

    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.add(publicId);
    }

    client.emit('subscription-confirmed', { publicId });
  }

  @SubscribeMessage('unsubscribe-monitor')
  handleUnsubscribeMonitor(client: Socket, publicId: string) {
    const room = `monitor-${publicId}`;
    client.leave(room);

    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.delete(publicId);
    }
  }

  @SubscribeMessage('subscribe-all')
  handleSubscribeAll(client: Socket) {
    client.join('all-monitors');
    client.emit('subscription-confirmed', { all: true });
  }

  @SubscribeMessage('unsubscribe-all')
  handleUnsubscribeAll(client: Socket) {
    client.leave('all-monitors');
  }

  sendMonitorUpdate(monitor: any) {
    const updateData = {
      type: 'monitor_update',
      data: monitor,
      timestamp: new Date().toISOString(),
    };

    // Send to specific monitor room
    if (monitor && monitor.public_id) {
      this.server
        .to(`monitor-${monitor.public_id}`)
        .emit('monitor-update', updateData);
    }

    // Broadcast to all monitors room
    this.server.to('all-monitors').emit('monitor-update', updateData);
  }

  sendBatchUpdate(monitors: any[]) {
    this.server.to('all-monitors').emit('batch-update', {
      type: 'batch_update',
      data: monitors,
      timestamp: new Date().toISOString(),
    });
  }
}