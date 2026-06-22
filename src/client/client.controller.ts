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
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import type { JwtUser } from 'src/auth/types/user.interface';

@UseGuards(JwtAuthGuard)
@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post('create')
  create(@Body() createClientDto: CreateClientDto, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.clientService.create(createClientDto, user);
  }

  @Get('allClients')
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.clientService.findAll(
      {
        search,
        filter,
        sort,
      },
      user,
    );
  }

  @Get('filters')
  getFilters() {
    return this.clientService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.clientService.getSorts();
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.clientService.findOne(public_id, user);
  }

  @Patch(':public_id')
  update(
    @Param('public_id') public_id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.clientService.update(public_id, updateClientDto, user);
  }

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.clientService.bulkDelete(body.public_ids, user);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req?: Request) {
    const user = req?.user as JwtUser;
    return this.clientService.remove(public_id, user);
  }
}
