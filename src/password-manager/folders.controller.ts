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
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FoldersService } from './folders.service';
import { ItemsService } from './items.service';
import { JwtUser } from 'src/auth/types/user.interface';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ShareResourceDto } from './dto/share-resource.dto';

@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(
    private readonly foldersService: FoldersService,
    private readonly itemsService: ItemsService,
  ) {}

  @Get('allfolders')
  async findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return await this.foldersService.findAll(
      { search, filter, sort, page, limit },
      user,
    );
  }

  @Post('create') 
  async create(@Req() req: Request, @Body() body: CreateFolderDto) {
    const user = req?.user as JwtUser;
    return this.foldersService.create(body, user);
  }

  @Get(':public_id')
  async findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return await this.foldersService.findOne(public_id, user);
  }

  @Patch(':public_id')
  async update(
    @Req() req: Request,
    @Param('public_id') public_id: string,
    @Body() body: UpdateFolderDto,
  ) {
    const user = req?.user as JwtUser;
    return this.foldersService.update(public_id, body, user);
  }

  @Delete(':public_id')
  async remove(@Req() req: Request, @Param('public_id') public_id: string) {
    const user = req?.user as JwtUser;
    return this.foldersService.remove(public_id, user);
  }

  @Post(':public_id/share')
  async shareFolder(
    @Req() req: Request,
    @Param('public_id') public_id: string,
    @Body() shareDto: ShareResourceDto,
  ) {
    const user = req?.user as JwtUser;
    return this.itemsService.shareResource(public_id, shareDto, user);
  }
}
