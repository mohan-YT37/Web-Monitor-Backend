// src/client/client.module.ts
import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { PermissionsModule } from 'src/permissions/permissions.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Client]),
    PermissionsModule, 
  ],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}