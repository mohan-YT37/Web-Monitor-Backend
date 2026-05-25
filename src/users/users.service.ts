import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Like, Repository } from 'typeorm';
import { CatchError } from '../common/response/catch-error.util';
import {
  errorResponse,
  permissionDenied,
  successResponse,
} from '../common/response/response.util';
import { hasPermission } from 'src/common/helper/menu.permission.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findAll(page, limit, search) {
    try {
      const searchUser = search
        ? [
            { username: Like(`%${search}%`) },
            { role: Like(`%${search}%`) },
            { active: Like(`%${search}%`) },
          ]
        : {};

      let users;
      let total;

      if (Number(limit) === -1) {
        users = await this.userRepo.find({
          where: searchUser,
          order: { id: 'ASC' },
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
        total = users.length;
      } else {
        const [data, count] = await this.userRepo.findAndCount({
          where: searchUser,
          skip: (page - 1) * Number(limit),
          take: limit,
          order: { id: 'ASC' },
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

        users = data;
        total = count;
      }

      const usersData = {
        data: users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      if (!users || users.length === 0) {
        return successResponse([], 'No Users Found', 200);
      }

      return successResponse(usersData, 'Users Founded', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string) {
    try {
      const user = await this.userRepo.findOne({
        where: { public_id: public_id },
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

      if (!user) {
        return errorResponse('User Not Found', 400);
      }
      return successResponse(user, 'User Founded', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async create(body: CreateUserDto, user: any) {
    try {
      if (!hasPermission(user?.role, 'users', 'create')) {
        return permissionDenied('create', 'users');
      }

      const existingUser = await this.userRepo.findOne({
        where: { email: body?.email },
      });

      if (existingUser) {
        return errorResponse('Email Already Exists', 409);
      }

      const newUser = await this.userRepo.create({
        ...body,
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
      if (!hasPermission(user?.role, 'users', 'edit')) {
        return permissionDenied('edit', 'users');
      }
      const findUser = await this.userRepo.findOne({
        where: { public_id: public_id },
        select: [
          'username',
          'email',
          'role',
          'active',
          'public_id',
          'profile_img',
          'id',
          'created_at',
          'updated_at',
        ],
      });

      if (!findUser) {
        return errorResponse('User Not Found', 400);
      }
      Object.assign(findUser, data); //(target, source) -> it copies values from source into target
      findUser.updated_by = user?.id;
      const savedUser = await this.userRepo.save(findUser);
      return successResponse(savedUser, 'User Updated Sucessfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      if (!hasPermission(user?.role, 'users', 'delete')) {
        return permissionDenied('delete', 'users');
      }

      const findUser = await this.userRepo.findOne({
        where: { public_id: public_id },
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
}
