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
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { JwtUser } from 'src/auth/types/user.interface';
import { DepartmentService } from './departments.service';

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post('create')
  create(
    @Body() createDepartmentDto: CreateDepartmentDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.departmentService.create(createDepartmentDto, user);
  }

  @Get('alldepartments')
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.departmentService.findAll(
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
    return this.departmentService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.departmentService.getSorts();
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.departmentService.findOne(public_id, user);
  }

  @Patch(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.departmentService.update(public_id, updateDepartmentDto, user);
  }

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.departmentService.bulkDelete(body.public_ids, user);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.departmentService.remove(public_id, user);
  }
}
