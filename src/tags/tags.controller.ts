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
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { JwtUser } from 'src/auth/types/user.interface';
import { TagService } from './tags.service';

@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post('create')
  create(@Body() createTagDto: CreateTagDto, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.tagService.create(createTagDto, user);
  }

  @Get('alltags')
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.tagService.findAll(
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
    return this.tagService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.tagService.getSorts();
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.tagService.findOne(public_id, user);
  }

  @Patch(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() updateTagDto: UpdateTagDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.tagService.update(public_id, updateTagDto, user);
  }

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.tagService.bulkDelete(body.public_ids, user);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.tagService.remove(public_id, user);
  }
}
