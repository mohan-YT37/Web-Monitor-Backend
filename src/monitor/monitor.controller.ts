import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Put,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtUser } from 'src/auth/types/user.interface';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('monitors')
export class MonitorController {
  constructor(private monitorService: MonitorService) {}

  @Post('create')
  create(@Body() body: CreateMonitorDto, @Req() req: Request) {
    // console.log('body : ', body);
    const user = req?.user as JwtUser;
    return this.monitorService.create(body, user);
  }

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  bulkUpload(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const user = req?.user as JwtUser;
    return this.monitorService.bulkUpload(user, file);
  }

  @Get('filters')
  getFilters() {
    return this.monitorService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.monitorService.getSorts();
  }

  @Get('intervals')
  getIntervals() {
    return this.monitorService.getIntervals();
  }

  @Get('time-ranges')
  getTimeRanges() {
    return this.monitorService.getTimeRanges();
  }

  @Get('retryoptions')
  getRetryOptions() {
    return this.monitorService.getRetryOptions();
  }

  @Get('notificationtype')
  getNotificationTypes() {
    return this.monitorService.getNotificationTypes();
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;

    return this.monitorService.findAll({
      search,
      filter,
      sort,
    },user);
  }

  // BULK DELETE
  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    // console.log('Bulk delete request for public_ids:', body.public_ids);
    const user = req?.user as JwtUser;
    return this.monitorService.bulkDelete(body.public_ids, user);
  }

  // GET single monitor
  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req: Request) {
    // console.log('Find one request for public_id:', public_id);
    const user = req?.user as JwtUser;
    return this.monitorService.findOne(public_id, user);
  }

  // UPDATE single monitor
  @Put(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() body: UpdateMonitorDto,
    @Req() req: Request,
  ) {
    // console.log('Update_Body:', body);
    const user = req?.user as JwtUser;
    return this.monitorService.update(public_id, body, user);
  }

  // DELETE single monitor
  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req: Request) {
    // console.log('Delete request for public_id:', public_id);
    const user = req?.user as JwtUser;
    return this.monitorService.remove(public_id, user);
  }
}
