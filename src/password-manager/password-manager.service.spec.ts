import { Test, TestingModule } from '@nestjs/testing';
import { FoldersService } from './folders.service';
import { ItemsService } from './items.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Folder } from './entities/folder.entity';
import { Item } from './entities/item.entity';
import { SharedResource } from './entities/shared-resource.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';

describe('PasswordManager Services', () => {
  let foldersService: FoldersService;
  let itemsService: ItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        ItemsService,
        {
          provide: getRepositoryToken(Folder),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Item),
          useValue: {},
        },
        {
          provide: getRepositoryToken(SharedResource),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: MailService,
          useValue: {},
        },
      ],
    }).compile();

    foldersService = module.get<FoldersService>(FoldersService);
    itemsService = module.get<ItemsService>(ItemsService);
  });

  it('should be defined', () => {
    expect(foldersService).toBeDefined();
    expect(itemsService).toBeDefined();
  });
});
