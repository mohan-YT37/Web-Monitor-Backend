import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { In, Like, Repository } from 'typeorm';
import { CatchError } from '../common/response/catch-error.util';
import {
  errorResponse,
  permissionDenied,
  successResponse,
} from '../common/response/response.util';
import { hasPermission } from 'src/common/helper/menu.permission.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PermissionsService } from 'src/permissions/permissions.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private permissionsService: PermissionsService,
  ) {}

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
      const page = Number(query?.page ?? 0);
      const limit = Number(query?.limit ?? -1);
      const fetchAll = page <= 0 || limit <= 0;

      const qb = this.userRepo.createQueryBuilder('user');

      // SEARCH
      if (query?.search) {
        qb.andWhere(
          `
        (
          user.username LIKE :search OR
          user.role LIKE :search OR
          user.email LIKE :search
        )
      `,
          {
            search: `%${query.search}%`,
          },
        );
      }

      // FILTER
      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('user.active = :active', {
              active: true,
            });
            break;

          case 'INACTIVE':
            qb.andWhere('user.active = :active', {
              active: false,
            });
            break;

          case 'ADMIN':
            qb.andWhere('user.role = :role', {
              role: 'ADMIN',
            });
            break;

          case 'USER':
            qb.andWhere('user.role = :role', {
              role: 'USER',
            });
            break;
        }
      }

      // SORT
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('user.username', 'ASC');
            break;

          case 'Z_A':
            qb.orderBy('user.username', 'DESC');
            break;

          case 'OLDEST':
            qb.orderBy('user.created_at', 'ASC');
            break;

          case 'NEWEST':
          default:
            qb.orderBy('user.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('user.created_at', 'DESC');
      }

      // SELECT FIELDS
      qb.select([
        'user.id',
        'user.public_id',
        'user.username',
        'user.email',
        'user.profile_img',
        'user.role',
        'user.active',
        'user.created_at',
        'user.updated_at',
      ]);

      // PAGINATION
      if (!fetchAll) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [users, total] = await qb.getManyAndCount();

      if (!users || users.length === 0) {
        return successResponse([], 'No Users Found', 200);
      }

      return successResponse(
        {
          data: users,
          pagination: {
            total,
            page,
            limit,
            totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
          },
        },
        'Users fetched successfully',
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
          'users',
          'view',
        ))
      ) {
        return permissionDenied('view', 'users');
      }

      const userData = await this.userRepo.findOne({
        where: { public_id: public_id, created_by: user?.id },
        select: [
          'username',
          'email',
          'id',
          'public_id',
          'profile_img',
          'role',
          'active',
          'created_at',
          'updated_at',
        ],
      });

      if (!userData) {
        return errorResponse('User Not Found', 400);
      }
      return successResponse(userData, 'User Founded', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async create(body: CreateUserDto, user: any) {
    try {
      if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'users',
          'create',
        ))
      ) {
        return permissionDenied('create', 'users');
      }

      if (!body.password) {
        return errorResponse('Password is required', 400);
      }

      const existingUser = await this.userRepo.findOne({
        where: { email: body?.email },
      });

      if (existingUser) {
        return errorResponse('Email Already Exists', 409);
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);

      const newUser = this.userRepo.create({
        ...body,
        password: hashedPassword,
        created_by: user?.id,
      });

      const savedUser = await this.userRepo.save(newUser);

      return successResponse(savedUser, 'User Created Successfully', 201);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, data: UpdateUserDto, user: any) {
    try {
      if (
        !(await this.permissionsService.hasPermission(
          user?.role,
          'users',
          'edit',
        ))
      ) {
        return permissionDenied('edit', 'users');
      }

      const findUser = await this.userRepo.findOne({
        where: { public_id, created_by: user?.id },
      });

      if (!findUser) {
        return errorResponse('User Not Found', 400);
      }

      // Hash password only if new password provided
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      } else {
        delete data.password;
      }

      Object.assign(findUser, data);

      findUser.updated_by = user?.id;

      const savedUser = await this.userRepo.save(findUser);

      return successResponse(savedUser, 'User Updated Successfully', 200);
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
          'users',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'users');
      }

      const findUser = await this.userRepo.findOne({
        where: { public_id: public_id, created_by: user?.id },
      });

      if (!findUser) {
        return errorResponse('User Not Found', 400);
      }

      findUser.deleted_by = user?.id;

      await this.userRepo.save(findUser);
      await this.userRepo.softDelete(findUser?.id);
      return successResponse(null, 'User deleted successfully', 204);
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
          'users',
          'delete',
        ))
      ) {
        return permissionDenied('delete', 'users');
      }
      
      const users = await this.userRepo.find({
        where: {
          public_id: In(public_ids),
          created_by: user?.id,
        },
        select: ['id'],
      });

      if (!users.length) {
        return errorResponse('No users found', 404);
      }

      const ids = users.map((u) => u.id);

      await this.userRepo.update({ id: In(ids) }, { deleted_by: user?.id });

      await this.userRepo.softDelete(ids);

      return successResponse(
        { deleted: ids.length },
        'Users deleted successfully',
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

  async getRoles() {
    return successResponse(
      [
        { id: 1, name: 'Super Admin', value: 'super_admin' },
        { id: 2, name: 'Manager', value: 'manager' },
        { id: 3, name: 'Employee', value: 'employee' },
      ],
      'User Role Fetced Successfully',
      200,
    );
  }
}
