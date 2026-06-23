import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CatchError } from 'src/common/response/catch-error.util';
import {
  errorResponse,
  successResponse,
  permissionDenied,
} from 'src/common/response/response.util';
import { hasPermission } from 'src/common/helper/menu.permission.helper';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
  ) {}

  async create(body: CreateGroupDto, user: any) {
    try {
      if (!hasPermission(user?.role, 'group', 'create')) {
        return permissionDenied('create', 'group');
      }

      const existingGroup = await this.groupRepo.findOne({
        where: { name: body.name },
      });

      if (existingGroup) {
        return errorResponse('Group with this name already exists', 409);
      }

      const newGroup = this.groupRepo.create({
        ...body,
        created_by: user?.id,
      });

      const savedGroup = await this.groupRepo.save(newGroup);

      return successResponse(savedGroup, 'Group created successfully', 201);
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

      const qb = this.groupRepo.createQueryBuilder('group');

      qb.andWhere('group.created_by = :userId', {
        userId: user?.id,
      });

      if (query?.search) {
        qb.andWhere(
          '(group.name LIKE :search OR group.label LIKE :search OR group.description LIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('group.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('group.active = :active', { active: 0 });
            break;
        }
      }

      // Sort
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('group.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('group.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('group.created_at', 'ASC');
            break;
          case 'NEWEST':
          default:
            qb.orderBy('group.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('group.created_at', 'DESC');
      }

      qb.select([
        'group.id',
        'group.public_id',
        'group.name',
        'group.label',
        'group.description',
        'group.active',
        'group.created_at',
        'group.updated_at',
      ]);

      if (limit !== -1) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [groups, total] = await qb.getManyAndCount();

      if (!groups || groups.length === 0) {
        return successResponse([], 'No Groups Found', 200);
      }

      return successResponse(
        {
          data: groups,
          pagination: {
            total,
            page,
            limit,
            totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
          },
        },
        'Groups fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {
      const group = await this.groupRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!group) {
        return errorResponse('Group not found', 404);
      }

      return successResponse(group, 'Group fetched successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, body: UpdateGroupDto, user: any) {
    try {
      const group = await this.groupRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!group) {
        return errorResponse('Group not found', 404);
      }

      if (!hasPermission(user?.role, 'group', 'edit')) {
        return permissionDenied('edit', 'group');
      }

      if (body.name && body.name !== group.name) {
        const existingGroup = await this.groupRepo.findOne({
          where: { name: body.name },
        });

        if (existingGroup) {
          return errorResponse('Group with this name already exists', 409);
        }
      }

      Object.assign(group, body);
      group.updated_by = user?.id;

      const updatedGroup = await this.groupRepo.save(group);

      return successResponse(updatedGroup, 'Group updated successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const group = await this.groupRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!group) {
        return errorResponse('Group not found', 404);
      }

      if (!hasPermission(user?.role, 'group', 'delete')) {
        return permissionDenied('delete', 'group');
      }

      group.deleted_by = user?.id;
      await this.groupRepo.save(group);
      await this.groupRepo.softDelete(group.id);

      return successResponse(null, 'Group deleted successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async bulkDelete(public_ids: string[], user: any) {
    try {
      if (!public_ids?.length) {
        return errorResponse('No group IDs provided', 400);
      }

      if (!hasPermission(user?.role, 'group', 'delete')) {
        return permissionDenied('delete', 'group');
      }

      const groups = await this.groupRepo.find({
        where: {
          public_id: In(public_ids),
          created_by: user?.id,
        },
        select: ['id'],
      });

      if (!groups.length) {
        return errorResponse('No groups found', 404);
      }

      const ids = groups.map((g) => g.id);

      await this.groupRepo.update({ id: In(ids) }, { deleted_by: user?.id });
      await this.groupRepo.softDelete(ids);

      return successResponse(
        { deleted: ids.length },
        'Groups deleted successfully',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async getFilters() {
    return successResponse(
      [
        { id: 1, value: '', label: 'All' },
        { id: 2, value: 'ACTIVE', label: 'Active' },
        { id: 3, value: 'INACTIVE', label: 'In-active' },
      ],
      'Filter options fetched successfully',
      200,
    );
  }

  async getSorts() {
    return successResponse(
      [
        { id: 1, value: 'A_Z', label: 'A to Z' },
        { id: 2, value: 'Z_A', label: 'Z to A' },
        { id: 3, value: 'NEWEST', label: 'Newest First' },
        { id: 4, value: 'OLDEST', label: 'Oldest First' },
      ],
      'Sort options fetched successfully',
      200,
    );
  }
}