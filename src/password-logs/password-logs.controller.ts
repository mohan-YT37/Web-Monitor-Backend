import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LogsService } from './password-logs.service';

@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('alllogs')
  async findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.logsService.findAll({ search, filter, sort, page, limit });
  }

  @Get('filters')
  getFilters() {
    return this.logsService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.logsService.getSorts();
  }

  @Get(':public_id')
  async findOne(@Param('public_id') public_id: string) {
    return this.logsService.findOne(public_id);
  }
}