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
  Put,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { JwtUser } from 'src/auth/types/user.interface';
import { RoleService } from './roles.service';
import { UpdateRolePermissionsDto } from 'src/permissions/dto/update-role-permissions.dto';

@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post('create')
  create(@Body() createRoleDto: CreateRoleDto, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.roleService.create(createRoleDto, user);
  }

  @Get('allroles')
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.roleService.findAll(
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
    return this.roleService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.roleService.getSorts();
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.roleService.findOne(public_id, user);
  }
  @Get(':public_id/menus')
  getMenus(@Param('public_id') public_id: string) {
    return this.roleService.getMenus(public_id);
  }

  @Put(':public_id/menus')
  updateMenus(
    @Param('public_id') public_id: string,
    @Body() body: UpdateRolePermissionsDto,
    @Req() req: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.roleService.updateMenus(public_id, body.permissions, user);
  }

  @Patch(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.roleService.update(public_id, updateRoleDto, user);
  }

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.roleService.bulkDelete(body.public_ids, user);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.roleService.remove(public_id, user);
  }
}
