import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CatchError } from 'src/common/response/catch-error.util';
import {
  errorResponse,
  successResponse,
  permissionDenied,
} from 'src/common/response/response.util';
import { PermissionsService } from 'src/permissions/permissions.service';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    private permissionsService: PermissionsService,
  ) {}

  async create(body: CreateDepartmentDto, user: any) {
    try {
      if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'department',
          'create',
        ))
      ) {
        return permissionDenied('create', 'department');
      }

      const existingDepartment = await this.departmentRepo.findOne({
        where: { name: body.name },
      });

      if (existingDepartment) {
        return errorResponse('Department with this name already exists', 409);
      }

      const newDepartment = this.departmentRepo.create({
        ...body,
        created_by: user?.id,
      });

      const savedDepartment = await this.departmentRepo.save(newDepartment);

      return successResponse(
        savedDepartment,
        'Department created successfully',
        201,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findAll(
    query?: {
      search?: string;
      filter?: string;
      sort?: string;
      page?: number;
      limit?: number;
    },
    user?: any,
  ) {
    try {
      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;

      const qb = this.departmentRepo.createQueryBuilder('department');

      qb.andWhere('department.created_by = :userId', {
        userId: user?.id,
      });

      if (query?.search) {
        qb.andWhere(
          '(department.name LIKE :search OR department.label LIKE :search OR department.description LIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('department.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('department.active = :active', { active: 0 });
            break;
        }
      }

      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('department.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('department.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('department.created_at', 'ASC');
            break;
          case 'NEWEST':
          default:
            qb.orderBy('department.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('department.created_at', 'DESC');
      }

      qb.select([
        'department.id',
        'department.public_id',
        'department.name',
        'department.value',
        'department.description',
        'department.active',
        'department.created_at',
        'department.updated_at',
      ]);

      if (limit !== -1) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [departments, total] = await qb.getManyAndCount();

      if (!departments || departments.length === 0) {
        return successResponse([], 'No Departments Found', 200);
      }

      return successResponse(
        {
          data: departments,
          pagination: {
            total,
            page,
            limit,
            totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
          },
        },
        'Departments fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {
       if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'department',
          'view',
        ))
      ) {
        return permissionDenied('view', 'department');
      }

      const department = await this.departmentRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!department) {
        return errorResponse('Department not found', 404);
      }

      return successResponse(
        department,
        'Department fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, body: UpdateDepartmentDto, user: any) {
    try {
       if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'department',
          'edit',
        ))
      ) {
        return permissionDenied('edit', 'department');
      }

      const department = await this.departmentRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!department) {
        return errorResponse('Department not found', 404);
      }

      if (body.name && body.name !== department.name) {
        const existingDepartment = await this.departmentRepo.findOne({
          where: { name: body.name },
        });

        if (existingDepartment) {
          return errorResponse('Department with this name already exists', 409);
        }
      }

      Object.assign(department, body);
      department.updated_by = user?.id;

      const updatedDepartment = await this.departmentRepo.save(department);

      return successResponse(
        updatedDepartment,
        'Department updated successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {

       if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'department',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'department');
      }

      const department = await this.departmentRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!department) {
        return errorResponse('Department not found', 404);
      }


      department.deleted_by = user?.id;
      await this.departmentRepo.save(department);
      await this.departmentRepo.softDelete(department.id);

      return successResponse(null, 'Department deleted successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async bulkDelete(public_ids: string[], user: any) {
    try {

       if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'department',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'department');
      }

      if (!public_ids?.length) {
        return errorResponse('No department IDs provided', 400);
      }

      const departments = await this.departmentRepo.find({
        where: {
          public_id: In(public_ids),
          created_by: user?.id,
        },
        select: ['id'],
      });

      if (!departments.length) {
        return errorResponse('No departments found', 404);
      }

      const ids = departments.map((d) => d.id);

      await this.departmentRepo.update(
        { id: In(ids) },
        { deleted_by: user?.id },
      );
      await this.departmentRepo.softDelete(ids);

      return successResponse(
        { deleted: ids.length },
        'Departments deleted successfully',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async getFilters() {
    return successResponse(
      [
        { id: 1, value: '', name: 'All' },
        { id: 2, value: 'ACTIVE', name: 'Active' },
        { id: 3, value: 'INACTIVE', name: 'In-active' },
      ],
      'Filter options fetched successfully',
      200,
    );
  }

  async getSorts() {
    return successResponse(
      [
        { id: 1, value: 'A_Z', name: 'A to Z' },
        { id: 2, value: 'Z_A', name: 'Z to A' },
        { id: 3, value: 'NEWEST', name: 'Newest First' },
        { id: 4, value: 'OLDEST', name: 'Oldest First' },
      ],
      'Sort options fetched successfully',
      200,
    );
  }
}
