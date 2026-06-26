import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeRolesService } from './employee-roles.service';

describe('EmployeeRolesService', () => {
  let service: EmployeeRolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeeRolesService],
    }).compile();

    service = module.get<EmployeeRolesService>(EmployeeRolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
