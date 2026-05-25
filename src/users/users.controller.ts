import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/types/user.interface';
import { Request } from 'express';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { successResponse } from 'src/common/response/response.util';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('allUsers')
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
  ) {
    return await this.usersService.findAll(page, limit, search);
  }

  @Get('roles')
  async userRoles() {
    const data = [
      { id: 1, label: 'Super Admin', value: 'super_admin' },
      { id: 2, label: 'Admin', value: 'admin' },
      { id: 3, label: 'Manager', value: 'Manager' }   ,
    ];

    return successResponse(data, 'User Role Fetced Successfully', 200);
  }

  @Get(':public_id')
  async findOne(@Param('public_id') public_id: string) {
    return await this.usersService.findOne(public_id);
  }

  @Post('/create')
  async create(@Req() req: Request, @Body() body: CreateUserDto) {
    const user = req?.user as JwtUser;
    // console.log('createUserId',user?.id)
    return this.usersService.create(body, user);
  }

  @Patch(':public_id')
  async update(
    @Req() req: Request,
    @Param('public_id') public_id: string,
    @Body() body: UpdateUserDto,
  ) {
    const user = req?.user as JwtUser;
    return this.usersService.update(public_id, body, user);
  }

  @Delete(':public_id')
  async remove(@Req() req: Request, @Param('public_id') public_id: string) {
    const user = req?.user as JwtUser;
    return this.usersService.remove(public_id, user);
  }
}
