import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folder } from './entities/folder.entity';
import {
  errorResponse,
  permissionDenied,
  successResponse,
} from 'src/common/response/response.util';
import { CatchError } from 'src/common/response/error.utils';
import { CreateFolderDto } from './dto/create-folder.dto';
import { hasPermission } from 'src/common/helper/menu.permission.helper';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder)
    private folderRepo: Repository<Folder>,
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
      // page=0 or limit=-1 → return ALL records (no pagination)
      const page = Number(query?.page ?? 0);
      const limit = Number(query?.limit ?? -1);

      const fetchAll = page <= 0 || limit <= 0;

      const qb = this.folderRepo.createQueryBuilder('folder');

      // Only show folders created by user OR where user ID exists in permissions JSON array
      qb.where('folder.created_by = :userId', { userId: user?.id }).orWhere(
        "JSON_CONTAINS(folder.permissions, :userPermission, '$')",
        {
          userPermission: JSON.stringify(user?.id),
        },
      );

      // SEARCH
      if (query?.search) {
        qb.andWhere(
          '(folder.name LIKE :search OR folder.description LIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      // FILTER
      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('folder.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('folder.active = :active', { active: 0 });
            break;
        }
      }

      // SORT
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('folder.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('folder.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('folder.created_at', 'ASC');
            break;
          case 'NEWEST':
          default:
            qb.orderBy('folder.created_at', 'ASC');
            break;
        }
      } else {
        qb.orderBy('folder.created_at', 'ASC');
      }

      // SELECT FIELDS
      qb.select([
        'folder.id',
        'folder.public_id',
        'folder.name',
        'folder.description',
        'folder.permissions',
        'folder.active',
        'folder.created_at',
        'folder.updated_at',
      ]);

      // PAGINATION – skip when fetchAll
      if (!fetchAll) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [folders, total] = await qb.getManyAndCount();

      if (!folders || folders.length === 0) {
        return successResponse([], 'No Folders Found', 200);
      }

      const effectiveLimit = fetchAll ? -1 : limit;
      const effectivePage = fetchAll ? 0 : page;

      return successResponse(
        {
          data: folders,
          pagination: {
            total,
            page: effectivePage,
            limit: effectiveLimit,
            totalPages: fetchAll ? 1 : Math.ceil(total / effectiveLimit),
          },
        },
        'Folders fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {
      const folder = await this.folderRepo.findOne({
        where: { public_id },
        select: [
          'id',
          'public_id',
          'name',
          'description',
          'permissions',
          'active',
          'created_at',
          'updated_at',
          'created_by',
        ],
      });

      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      const hasAccess =
        folder.created_by === user?.id ||
        (folder.permissions && folder.permissions.includes(user?.id));

      if (!hasAccess) {
        return permissionDenied('view', 'folders');
      }

      return successResponse(folder, 'Folder Found', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async create(body: CreateFolderDto, user: any) {
    try {
      if (!hasPermission(user?.role, 'folders', 'create')) {
        return permissionDenied('create', 'folders');
      }
      console.log('body', ':', body);
      const newFolder = this.folderRepo.create({
        ...body,
        created_by: user?.id,
      });

      const savedFolder = await this.folderRepo.save(newFolder);

      return successResponse(savedFolder, 'Folder Created Successfully', 201);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, data: UpdateFolderDto, user: any) {
    try {
      const folder = await this.folderRepo.findOne({
        where: { public_id },
      });

      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      const hasEditAccess =
        folder.created_by === user?.id ||
        (folder.permissions && folder.permissions.includes(user?.id));

      if (!hasEditAccess) {
        return permissionDenied('edit', 'folders');
      }

      Object.assign(folder, data);
      folder.updated_by = user?.id;

      const savedFolder = await this.folderRepo.save(folder);

      return successResponse(savedFolder, 'Folder Updated Successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const folder = await this.folderRepo.findOne({
        where: { public_id },
      });

      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      if (
        !hasPermission(user?.role, 'folders', 'delete') &&
        folder.created_by !== user?.id
      ) {
        return permissionDenied('delete', 'folders');
      }

      folder.deleted_by = user?.id;
      await this.folderRepo.save(folder);
      await this.folderRepo.softDelete(folder.id);

      return successResponse(null, 'Folder deleted successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }
}
