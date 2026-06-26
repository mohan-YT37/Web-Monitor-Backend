import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CatchError } from 'src/common/response/catch-error.util';
import {
  errorResponse,
  successResponse,
  permissionDenied,
} from 'src/common/response/response.util';
import { PermissionsService } from 'src/permissions/permissions.service';
import { MenuPermissionItemDto } from 'src/permissions/dto/update-role-permissions.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private permissionsService: PermissionsService,
  ) {}

  async create(body: CreateRoleDto, user: any) {
    try {
      if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'role',
          'create',
        ))
      ) {
        return permissionDenied('create', 'role');
      }

      const existingRole = await this.roleRepo.findOne({
        where: { name: body.name },
      });
      if (existingRole) {
        return errorResponse('Role with this name already exists', 409);
      }

      const newRole = this.roleRepo.create({ ...body, created_by: user?.id });
      const savedRole = await this.roleRepo.save(newRole);

      await this.permissionsService.assignDefaultPermissions(savedRole);

      return successResponse(savedRole, 'Role created successfully', 201);
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

      const qb = this.roleRepo.createQueryBuilder('role');
      qb.andWhere('role.created_by = :userId', { userId: user?.id });

      if (query?.search) {
        qb.andWhere(
          '(role.name LIKE :search OR role.label LIKE :search OR role.description LIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('role.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('role.active = :active', { active: 0 });
            break;
        }
      }

      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('role.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('role.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('role.created_at', 'ASC');
            break;
          case 'NEWEST':
          default:
            qb.orderBy('role.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('role.created_at', 'DESC');
      }

      qb.select([
        'role.id',
        'role.public_id',
        'role.name',
        'role.value',
        'role.description',
        'role.active',
        'role.created_at',
        'role.updated_at',
      ]);

      if (limit !== -1) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [roles, total] = await qb.getManyAndCount();

      if (!roles || roles.length === 0) {
        return successResponse([], 'No Roles Found', 200);
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
        'Roles fetched successfully',
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
          'role',
          'view',
        ))
      ) {
        return permissionDenied('view', 'role');
      }

      const role = await this.roleRepo.findOne({
        where: { public_id, created_by: user?.id },
      });
      if (!role) return errorResponse('Role not found', 404);
      return successResponse(role, 'Role fetched successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, body: UpdateRoleDto, user: any) {
    try {
      if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'role',
          'edit',
        ))
      ) {
        return permissionDenied('edit', 'role');
      }

      const role = await this.roleRepo.findOne({
        where: { public_id, created_by: user?.id },
      });
      if (!role) return errorResponse('Role not found', 404);

      if (body.name && body.name !== role.name) {
        const existingRole = await this.roleRepo.findOne({
          where: { name: body.name },
        });
        if (existingRole)
          return errorResponse('Role with this name already exists', 409);
      }

      Object.assign(role, body);
      role.updated_by = user?.id;

      const updatedRole = await this.roleRepo.save(role);
      return successResponse(updatedRole, 'Role updated successfully', 200);
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
          'role',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'role');
      }

      const role = await this.roleRepo.findOne({
        where: { public_id, created_by: user?.id },
      });
      if (!role) return errorResponse('Role not found', 404);

      const systemRoles = ['super_admin', 'manager'];
      if (systemRoles.includes(role.name)) {
        return errorResponse('Cannot delete system roles', 403);
      }

      role.deleted_by = user?.id;
      await this.roleRepo.save(role);
      await this.roleRepo.softDelete(role.id);

      return successResponse(null, 'Role deleted successfully', 204);
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
          'role',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'role');
      }

      if (!public_ids?.length)
        return errorResponse('No role IDs provided', 400);

      const roles = await this.roleRepo.find({
        where: { public_id: In(public_ids), created_by: user?.id },
        select: ['id', 'name'],
      });

      if (!roles.length) return errorResponse('No roles found', 404);

      const systemRoles = ['super_admin', 'admin', 'employee'];
      const hasSystemRole = roles.some((r) => systemRoles.includes(r.name));
      if (hasSystemRole)
        return errorResponse('Cannot delete system roles', 403);

      const ids = roles.map((r) => r.id);
      await this.roleRepo.update({ id: In(ids) }, { deleted_by: user?.id });
      await this.roleRepo.softDelete(ids);

      return successResponse(
        { deleted: ids.length },
        'Roles deleted successfully',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  // GET /roles/:public_id/menus — prefill the role-edit screen
  async getMenus(public_id: string) {
    try {
      const role = await this.roleRepo.findOne({ where: { public_id } });
      if (!role) return errorResponse('Role not found', 404);

      const menus =
        await this.permissionsService.buildMenuTreeWithRolePermissions(
          role.value,
        );
      return successResponse(menus, 'Role menus fetched successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  // PUT /roles/:public_id/menus — add/edit/remove menu permissions for a role
  async updateMenus(
    public_id: string,
    items: MenuPermissionItemDto[],
    user: any,
  ) {
    try {
      const role = await this.roleRepo.findOne({ where: { public_id } });
      if (!role) return errorResponse('Role not found', 404);

      await this.permissionsService.upsertPermissions(role, items);

      const menus =
        await this.permissionsService.buildMenuTreeWithRolePermissions(
          role.value,
        );
      return successResponse(menus, 'Role menus updated successfully', 200);
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
