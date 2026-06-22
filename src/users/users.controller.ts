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

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('allUsers')
  async findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return await this.usersService.findAll(
      {
        search,
        filter,
        sort,
      },
      user,
    );
  }

  @Get('filters')
  getFilters() {
    return this.usersService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.usersService.getSorts();
  }

  @Get('roles')
  async getRoles() {
    return this.usersService.getRoles();
  }

  @Get(':public_id')
  async findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return await this.usersService.findOne(public_id, user);
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

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    console.log('userBulkDelete', body?.public_ids);
    return this.usersService.bulkDelete(body.public_ids, user);
  }
  
  @Delete(':public_id')
  async remove(@Req() req: Request, @Param('public_id') public_id: string) {
    const user = req?.user as JwtUser;
    return this.usersService.remove(public_id, user);
  }
}
