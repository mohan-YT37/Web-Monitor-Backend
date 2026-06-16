import { Test, TestingModule } from '@nestjs/testing';
import { FoldersController } from './folders.controller';
import { ItemsController } from './items.controller';
import { FoldersService } from './folders.service';
import { ItemsService } from './items.service';

describe('PasswordManager Controllers', () => {
  let foldersController: FoldersController;
  let itemsController: ItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoldersController, ItemsController],
      providers: [
        {
          provide: FoldersService,
          useValue: {},
        },
        {
          provide: ItemsService,
          useValue: {},
        },
      ],
    }).compile();

    foldersController = module.get<FoldersController>(FoldersController);
    itemsController = module.get<ItemsController>(ItemsController);
  });

  it('should be defined', () => {
    expect(foldersController).toBeDefined();
    expect(itemsController).toBeDefined();
  });
});
