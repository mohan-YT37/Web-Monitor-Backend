import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { CatchError } from 'src/common/response/catch-error.util';
import {
  errorResponse,
  successResponse,
  permissionDenied,
} from 'src/common/response/response.util';
import { hasPermission } from 'src/common/helper/menu.permission.helper';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private tagRepo: Repository<Tag>,
  ) {}

  async create(body: CreateTagDto, user: any) {
    try {
      if (!hasPermission(user?.role, 'tags', 'create')) {
        return permissionDenied('create', 'tags');
      }

      // Check for duplicate name
      const existingTag = await this.tagRepo.findOne({
        where: { name: body.name },
      });

      if (existingTag) {
        return errorResponse('Tag with this name already exists', 409);
      }

      const newTag = this.tagRepo.create({
        ...body,
        created_by: user?.id,
      });

      const savedTag = await this.tagRepo.save(newTag);

      return successResponse(savedTag, 'Tag created successfully', 201);
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

      const qb = this.tagRepo.createQueryBuilder('tag');

      // Only show tags created by user
      qb.andWhere('tag.created_by = :userId', {
        userId: user?.id,
      });

      // Search
      if (query?.search) {
        qb.andWhere(
          '(tag.name LIKE :search OR tag.label LIKE :search OR tag.description LIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      // Filter
      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('tag.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('tag.active = :active', { active: 0 });
            break;
        }
      }

      // Sort
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('tag.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('tag.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('tag.created_at', 'ASC');
            break;
          case 'NEWEST':
          default:
            qb.orderBy('tag.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('tag.created_at', 'DESC');
      }

      qb.select([
        'tag.id',
        'tag.public_id',
        'tag.name',
        'tag.label',
        'tag.description',
        'tag.active',
        'tag.created_at',
        'tag.updated_at',
      ]);

      if (limit !== -1) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [tags, total] = await qb.getManyAndCount();

      if (!tags || tags.length === 0) {
        return successResponse([], 'No Tags Found', 200);
      }

      return successResponse(
        {
          data: tags,
          pagination: {
            total,
            page,
            limit,
            totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
          },
        },
        'Tags fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {
      const tag = await this.tagRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!tag) {
        return errorResponse('Tag not found', 404);
      }

      return successResponse(tag, 'Tag fetched successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, body: UpdateTagDto, user: any) {
    try {
      const tag = await this.tagRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!tag) {
        return errorResponse('Tag not found', 404);
      }

      if (!hasPermission(user?.role, 'tags', 'edit')) {
        return permissionDenied('edit', 'tags');
      }

      // Check for duplicate name
      if (body.name && body.name !== tag.name) {
        const existingTag = await this.tagRepo.findOne({
          where: { name: body.name },
        });

        if (existingTag) {
          return errorResponse('Tag with this name already exists', 409);
        }
      }

      Object.assign(tag, body);
      tag.updated_by = user?.id;

      const updatedTag = await this.tagRepo.save(tag);

      return successResponse(updatedTag, 'Tag updated successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const tag = await this.tagRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!tag) {
        return errorResponse('Tag not found', 404);
      }

      if (!hasPermission(user?.role, 'tags', 'delete')) {
        return permissionDenied('delete', 'tags');
      }

      tag.deleted_by = user?.id;
      await this.tagRepo.save(tag);
      await this.tagRepo.softDelete(tag.id);

      return successResponse(null, 'Tag deleted successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async bulkDelete(public_ids: string[], user: any) {
    try {
      if (!public_ids?.length) {
        return errorResponse('No tag IDs provided', 400);
      }

      if (!hasPermission(user?.role, 'tags', 'delete')) {
        return permissionDenied('delete', 'tags');
      }

      const tags = await this.tagRepo.find({
        where: {
          public_id: In(public_ids),
          created_by: user?.id,
        },
        select: ['id'],
      });

      if (!tags.length) {
        return errorResponse('No tags found', 404);
      }

      const ids = tags.map((t) => t.id);

      await this.tagRepo.update({ id: In(ids) }, { deleted_by: user?.id });
      await this.tagRepo.softDelete(ids);

      return successResponse(
        { deleted: ids.length },
        'Tags deleted successfully',
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
