import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LogsService } from './password-logs.service';
import { Request } from 'express';
import { JwtUser } from 'src/auth/types/user.interface';

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
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.logsService.findAll(
      { search, filter, sort, page, limit },
      user,
    );
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
  async findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.logsService.findOne(public_id,user);
  }
}
