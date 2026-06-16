// employee.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Put,
  Delete,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtUser } from 'src/auth/types/user.interface';
import { Request } from 'express';
import { createStorage, documentFileFilter } from 'src/config/multer.config';

@UseGuards(JwtAuthGuard)
@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post('create')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: createStorage('employee-documents'),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: documentFileFilter,
    }),
  )
  create(
    @Req() req: Request,
    @Body() body: CreateEmployeeDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req?.user as JwtUser;

    // Handle file upload
    if (file) {
      body.document = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/employee-documents/${file.filename}`;
    }
    console.log('BODY =>', body);
    console.log('FILE =>', file);
    return this.employeeService.create(body, user);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const user = req?.user as JwtUser;
    return this.employeeService.findAll(
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
    return this.employeeService.getFilters();
  }

  @Get('sorts')
  getSorts() {
    return this.employeeService.getSorts();
  }

  @Delete('bulk-delete')
  bulkDelete(@Body() body: { public_ids: string[] }, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.employeeService.bulkDelete(body.public_ids, user);
  }

  @Get(':public_id')
  findOne(@Param('public_id') public_id: string, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.employeeService.findOne(public_id, user);
  }

  @Put(':public_id')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: createStorage('employee-documents'),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: documentFileFilter,
    }),
  )
  update(
    @Param('public_id') public_id: string,
    @Req() req: Request,
    @Body() body: UpdateEmployeeDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req?.user as JwtUser;

    // Handle file upload
    if (file) {
      body.document = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/employee-documents/${file.filename}`;
    }
    console.log('BODY =>', body);
    console.log('FILE =>', file);
    return this.employeeService.update(public_id, body, user);
  }

  @Delete(':public_id')
  remove(@Param('public_id') public_id: string, @Req() req: Request) {
    const user = req?.user as JwtUser;
    return this.employeeService.remove(public_id, user);
  }
}
