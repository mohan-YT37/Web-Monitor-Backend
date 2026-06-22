import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from './entities/folder.entity';
import { Item } from './entities/item.entity';
import { SharedResource } from './entities/shared-resource.entity';
import { User } from '../users/entities/user.entity';
import { FoldersController } from './folders.controller';
import { ItemsController } from './items.controller';
import { FoldersService } from './folders.service';
import { ItemsService } from './items.service';
import { MailModule } from '../mail/mail.module';
import { LogsModule } from 'src/logs/logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Folder, Item, SharedResource, User]),
    MailModule,
    LogsModule,
  ],
  controllers: [FoldersController, ItemsController],
  providers: [FoldersService, ItemsService],
  exports: [FoldersService, ItemsService],
})
export class PasswordManagerModule {}
