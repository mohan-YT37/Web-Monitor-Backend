
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
  } from '@nestjs/common';
  import { MonitorService } from './monitor.service';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { CreateMonitorDto } from './dto/create-monitor.dto';
  import { UpdateMonitorDto } from './dto/update-monitor.dto';

  @Controller('monitors')
  export class MonitorController {
    constructor(private monitorService: MonitorService) {}

    @Post('create')
    create(@Body() body: CreateMonitorDto) {
      console.log('body : ', body);
      return this.monitorService.create(body);
    }

    @Post('bulk')
    @UseInterceptors(FileInterceptor('file'))
    bulkUpload(@UploadedFile() file: Express.Multer.File) {
      return this.monitorService.bulkUpload(file);
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
    ) {
      return this.monitorService.findAll({
        search,
        filter,
        sort,
      });
    }

    // BULK DELETE 
    @Delete('bulk-delete')
    bulkDelete(@Body() body: { public_ids: string[] }) {
      console.log('Bulk delete request for public_ids:', body.public_ids);
      return this.monitorService.bulkDelete(body.public_ids);
    }

    // GET single monitor
    @Get(':public_id')
    findOne(@Param('public_id') public_id: string) {
      console.log('Find one request for public_id:', public_id);
      return this.monitorService.findOne(public_id);
    }

    // UPDATE single monitor
    @Put(':public_id')
    update(
      @Param('public_id') public_id: string,
      @Body() body: UpdateMonitorDto,
    ) {
      console.log('Update_Body:', body);
      return this.monitorService.update(public_id, body);
    }

    // DELETE single monitor 
    @Delete(':public_id')
    remove(@Param('public_id') public_id: string) {
      console.log('Delete request for public_id:', public_id);
      return this.monitorService.remove(public_id);
    }
  }
