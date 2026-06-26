import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeRolesController } from './employee-roles.controller';
import { EmployeeRolesService } from './employee-roles.service';

describe('EmployeeRolesController', () => {
  let controller: EmployeeRolesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeRolesController],
      providers: [EmployeeRolesService],
    }).compile();

    controller = module.get<EmployeeRolesController>(EmployeeRolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
