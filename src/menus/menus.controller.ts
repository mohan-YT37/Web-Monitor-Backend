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
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtUser } from 'src/auth/types/user.interface';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@UseGuards(JwtAuthGuard)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post('create')
  create(@Body() dto: CreateMenuDto, @Req() req: Request) {
    return this.menusService.create(dto, req.user as JwtUser);
  }

  // Static Menus Collection Upload
  @Post('seed')
  seed(@Req() req: Request) {
    return this.menusService.seed(req.user as JwtUser);
  }

  @Get('tree')
  findTree() {
    return this.menusService.findTree();
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string) {
    return this.menusService.findOne(public_id);
  }

  @Patch(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() dto: UpdateMenuDto,
    @Req() req: Request,
  ) {
    return this.menusService.update(public_id, dto, req.user as JwtUser);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req: Request) {
    return this.menusService.remove(public_id, req.user as JwtUser);
  }
}
