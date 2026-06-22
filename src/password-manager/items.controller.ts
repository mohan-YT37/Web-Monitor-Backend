// items.controller.ts
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
import { ItemsService } from './items.service';
import { JwtUser } from 'src/auth/types/user.interface';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  ShareResourceDto,
  VerifyShareOtpDto,
  CheckShareEmailDto,
} from './dto/share-resource.dto';
import { ShareWithUsersDto } from './dto/share-with-users.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('allitems')
  async findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('folder_id') folder_id?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return await this.itemsService.findAll(
      { search, filter, sort, page, limit, folder_id },
      user,
    );
  }

  @Get('filters')
  getFilters() {
    return this.itemsService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.itemsService.getSorts();
  }

  // NEW: tag options for the items multi-select
  @Get('tags')
  getTags() {
    return this.itemsService.getTags();
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async create(@Req() req: Request, @Body() body: CreateItemDto) {
    const user = req?.user as JwtUser;
    return this.itemsService.create(body, user);
  }

  /** Step 0: Email gate — validate email before showing OTP or content */
  @Post('share/check-email')
  async checkShareEmail(@Body() dto: CheckShareEmailDto) {
    return this.itemsService.checkShareEmail(dto);
  }

  /** Step 1 (personal): Verify OTP sent to user's email */
  @Post('share/verify-otp')
  async verifyShareOtp(@Body() verifyDto: VerifyShareOtpDto) {
    return this.itemsService.verifyShareOtp(verifyDto);
  }

  /** Step 1 (public): Direct access by token (after email gate passes) */
  @Get('share/access/:token')
  async accessSharedResource(@Param('token') token: string) {
    return this.itemsService.accessSharedResource(token);
  }

  /** Folder items public endpoint */
  @Get('share/folder-items/:token')
  async accessSharedFolderItems(@Param('token') token: string) {
    return this.itemsService.accessSharedFolderItems(token);
  }

  //  Authenticated endpoints

  @UseGuards(JwtAuthGuard)
  @Delete('bulk/delete')
  async bulkRemove(
    @Req() req: Request,
    @Body() body: { public_ids: string[] },
  ) {
    const user = req?.user as JwtUser;
    return this.itemsService.bulkRemove(body.public_ids, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':public_id')
  async findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return await this.itemsService.findOne(public_id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':public_id')
  async update(
    @Req() req: Request,
    @Param('public_id') public_id: string,
    @Body() body: UpdateItemDto,
  ) {
    const user = req?.user as JwtUser;
    return this.itemsService.update(public_id, body, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':public_id')
  async remove(@Req() req: Request, @Param('public_id') public_id: string) {
    const user = req?.user as JwtUser;
    return this.itemsService.remove(public_id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':public_id/share')
  async shareResource(
    @Req() req: Request,
    @Param('public_id') public_id: string,
    @Body() shareDto: ShareResourceDto,
  ) {
    const user = req?.user as JwtUser;
    return this.itemsService.shareResource(public_id, shareDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':public_id/share-users')
  async shareWithUsers(
    @Req() req: Request,
    @Param('public_id') public_id: string,
    @Body() dto: ShareWithUsersDto,
  ) {
    const user = req?.user as JwtUser;
    return this.itemsService.shareWithUsers(public_id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':public_id/copy')
  async copyItem(@Req() req: Request, @Param('public_id') public_id: string) {
    const user = req?.user as JwtUser;
    return this.itemsService.copyItem(public_id, user);
  }
}
