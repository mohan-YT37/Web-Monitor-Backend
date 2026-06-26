// src/employee-roles/employee-roles.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { EmployeeRolesService } from './employee-roles.service';
import { CreateEmployeeRoleDto } from './dto/create-employee-role.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { JwtUser } from 'src/auth/types/user.interface';

@UseGuards(JwtAuthGuard)
@Controller('employee-roles')
export class EmployeeRolesController {
  constructor(private readonly employeeRolesService: EmployeeRolesService) {}

  @Post('create')
  create(
    @Body() createEmployeeRoleDto: CreateEmployeeRoleDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.employeeRolesService.create(createEmployeeRoleDto, user);
  }

  @Get('allemployeerole')
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.employeeRolesService.findAll(
      {
        search,
        filter,
        sort,
        page,
        limit,
      },
      user,
    );
  }

  @Get('filters')
  getFilters() {
    return this.employeeRolesService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.employeeRolesService.getSorts();
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.employeeRolesService.findOne(public_id, user);
  }

  @Patch(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() updateEmployeeRoleDto: UpdateEmployeeRoleDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.employeeRolesService.update(
      public_id,
      updateEmployeeRoleDto,
      user,
    );
  }

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.employeeRolesService.bulkDelete(body.public_ids, user);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.employeeRolesService.remove(public_id, user);
  }
}
