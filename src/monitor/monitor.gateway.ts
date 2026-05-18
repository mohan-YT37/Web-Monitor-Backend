import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({ //Creates WebSocket gateway/server. --> Realtime communication server
  cors: {
    origin: '*',
  },

  transports: ['websocket'], //Force pure WebSocket connection. --> Only websocket connection
})
export class MonitorGateway implements OnGatewayConnection {
  @WebSocketServer() //Automatically injects socket server instance.
  server!: Server;

  afterInit() { //Runs after socket server starts successfully.
    console.log('Socket Initialized');
  }

  handleConnection(client: Socket) { //Runs automatically when frontend connects.
    console.log('Client Connected =>', client.id);
  }

  sendMonitorUpdate(data: any) { //Custom method --> Used to send monitoring data to frontend.
    this.server.emit('monitor-update', data);
  }
}
