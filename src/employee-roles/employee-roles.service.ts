// src/employee-roles/employee-roles.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmployeeRole } from './entities/employee-role.entity';
import { CreateEmployeeRoleDto } from './dto/create-employee-role.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { CatchError } from 'src/common/response/catch-error.util';
import {
  errorResponse,
  successResponse,
  permissionDenied,
} from 'src/common/response/response.util';
import { PermissionsService } from 'src/permissions/permissions.service';

@Injectable()
export class EmployeeRolesService {
  constructor(
    @InjectRepository(EmployeeRole)
    private employeeRoleRepo: Repository<EmployeeRole>,
    private permissionsService: PermissionsService,
  ) {}

  async create(body: CreateEmployeeRoleDto, user: any) {
    try {
      if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'employeerole',
          'create',
        ))
      ) {
        return permissionDenied('create', 'employeerole');
      }

      // Check for duplicate name
      const existingRole = await this.employeeRoleRepo.findOne({
        where: { name: body.name },
      });

      if (existingRole) {
        return errorResponse(
          'Employee role with this name already exists',
          409,
        );
      }

      const newRole = this.employeeRoleRepo.create({
        ...body,
        created_by: user?.id,
      });

      const savedRole = await this.employeeRoleRepo.save(newRole);

      return successResponse(
        savedRole,
        'Employee role created successfully',
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

      const qb = this.employeeRoleRepo.createQueryBuilder('employeeRole');

      // Filter by user who created
      qb.andWhere('employeeRole.created_by = :userId', {
        userId: user?.id,
      });

      if (query?.search) {
        qb.andWhere(
          '(employeeRole.name LIKE :search OR employeeRole.value LIKE :search OR employeeRole.description LIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('employeeRole.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('employeeRole.active = :active', { active: 0 });
            break;
        }
      }

      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('employeeRole.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('employeeRole.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('employeeRole.created_at', 'ASC');
            break;
          case 'NEWEST':
          default:
            qb.orderBy('employeeRole.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('employeeRole.created_at', 'DESC');
      }

      qb.select([
        'employeeRole.id',
        'employeeRole.public_id',
        'employeeRole.name',
        'employeeRole.value',
        'employeeRole.description',
        'employeeRole.active',
        'employeeRole.created_at',
        'employeeRole.updated_at',
      ]);

      if (limit !== -1) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [roles, total] = await qb.getManyAndCount();

      if (!roles || roles.length === 0) {
        return successResponse([], 'No employee roles found', 200);
      }

      return successResponse(
        {
          data: roles,
          pagination: {
            total,
            page,
            limit,
            totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
          },
        },
        'Employee roles fetched successfully',
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
          'employeerole',
          'view',
        ))
      ) {
        return permissionDenied('view', 'employeerole');
      }

      const role = await this.employeeRoleRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!role) {
        return errorResponse('Employee role not found', 404);
      }

      return successResponse(role, 'Employee role fetched successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, body: UpdateEmployeeRoleDto, user: any) {
    try {

       if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'employeerole',
          'edit',
        ))
      ) {
        return permissionDenied('edit', 'employeerole');
      }

      const role = await this.employeeRoleRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!role) {
        return errorResponse('Employee role not found', 404);
      }

  
      if (body.name && body.name !== role.name) {
        const existingRole = await this.employeeRoleRepo.findOne({
          where: { name: body.name },
        });

        if (existingRole) {
          return errorResponse(
            'Employee role with this name already exists',
            409,
          );
        }
      }

      Object.assign(role, body);
      role.updated_by = user?.id;

      const updatedRole = await this.employeeRoleRepo.save(role);

      return successResponse(
        updatedRole,
        'Employee role updated successfully',
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
          'employeerole',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'employeerole');
      }


      const role = await this.employeeRoleRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!role) {
        return errorResponse('Employee role not found', 404);
      }


      // Prevent deletion of system employee roles
      const systemRoles = ['super_employee', 'manager', 'team_lead'];
      if (systemRoles.includes(role.name)) {
        return errorResponse('Cannot delete system employee roles', 403);
      }

      role.deleted_by = user?.id;
      await this.employeeRoleRepo.save(role);
      await this.employeeRoleRepo.softDelete(role.id);

      return successResponse(null, 'Employee role deleted successfully', 204);
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
          'employeerole',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'employeerole');
      }


      if (!public_ids?.length) {
        return errorResponse('No employee role IDs provided', 400);
      }

      const roles = await this.employeeRoleRepo.find({
        where: {
          public_id: In(public_ids),
          created_by: user?.id,
        },
        select: ['id', 'name'],
      });

      if (!roles.length) {
        return errorResponse('No employee roles found', 404);
      }

      // Check for system roles
      const systemRoles = ['super_employee', 'manager', 'team_lead'];
      const hasSystemRole = roles.some((r) => systemRoles.includes(r.name));
      if (hasSystemRole) {
        return errorResponse('Cannot delete system employee roles', 403);
      }

      const ids = roles.map((r) => r.id);

      await this.employeeRoleRepo.update(
        { id: In(ids) },
        { deleted_by: user?.id },
      );
      await this.employeeRoleRepo.softDelete(ids);

      return successResponse(
        { deleted: ids.length },
        'Employee roles deleted successfully',
        200,
      );
    } catch (error) {
      console.error(error);
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
