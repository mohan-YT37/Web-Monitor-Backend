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

@Controller('monitors')
export class MonitorController {
  constructor(private monitorService: MonitorService) {}

  @Post()
  create(@Body() body: any) {
    return this.monitorService.create(body);
  }

  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  bulkUpload(@UploadedFile() file: Express.Multer.File) {
    return this.monitorService.bulkUpload(file);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('status') status?: string,
  ) {
    return this.monitorService.findAll({
      search,
      filter,
      status,
    });
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string) {
    return this.monitorService.findOne(public_id);
  }

  @Put(':public_id')
  update(@Param('public_id') public_id: string, @Body() body: any) {
    return this.monitorService.update(public_id, body);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string) {
    return this.monitorService.remove(public_id);
  }

  @Delete()
  bulkDelete(@Body() body: { public_ids: string[] }) {
    return this.monitorService.bulkDelete(body.public_ids);
  }
}
