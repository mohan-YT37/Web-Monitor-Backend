// folders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folder } from './entities/folder.entity';
import { Item } from './entities/item.entity';
import {
  errorResponse,
  permissionDenied,
  successResponse,
} from 'src/common/response/response.util';
import { CatchError } from 'src/common/response/error.utils';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ShareWithUsersDto } from './dto/share-with-users.dto';
import { hasPermission } from 'src/common/helper/menu.permission.helper';
import { FolderPermissionEntry } from './interfaces/folder-permission.interface';
import { LogsService } from 'src/logs/logs.service';

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder)
    private folderRepo: Repository<Folder>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    private logsService: LogsService,
  ) {}

  getFolderAccess(
    folder: Folder,
    userId: number,
  ): 'owner' | 'edit' | 'view' | null {
    if (folder.created_by === userId) return 'owner';
    const entry = (folder.permissions || []).find((p) => p.user_id === userId);
    return entry ? entry.access : null;
  }

  private async syncItemsPermissions(
    folderId: number,
    permissions: FolderPermissionEntry[],
  ) {
    await this.itemRepo.update({ folder_id: folderId }, { permissions });
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
      const page = Number(query?.page ?? 0);
      const limit = Number(query?.limit ?? -1);
      const fetchAll = page <= 0 || limit <= 0;

      const qb = this.folderRepo.createQueryBuilder('folder');

      qb.where('folder.created_by = :userId', { userId: user?.id }).orWhere(
        "JSON_CONTAINS(JSON_EXTRACT(folder.permissions, '$[*].user_id'), CAST(:userId AS JSON))",
        { userId: user?.id },
      );

      qb.andWhere(
        '(folder.deleted_by_users IS NULL OR NOT FIND_IN_SET(:hideUserId, folder.deleted_by_users))',
        { hideUserId: user?.id },
      );

      if (query?.search) {
        qb.andWhere(
          '(folder.name LIKE :search OR folder.description LIKE :search)',
          { search: `%${query.search}%` },
        );
      }

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

      switch (query?.sort?.toUpperCase()) {
        case 'A_Z':
          qb.orderBy('folder.name', 'ASC');
          break;
        case 'Z_A':
          qb.orderBy('folder.name', 'DESC');
          break;
        case 'OLDEST':
          qb.orderBy('folder.created_at', 'ASC');
          break;
        default:
          qb.orderBy('folder.created_at', 'ASC');
          break;
      }

      qb.select([
        'folder.id',
        'folder.public_id',
        'folder.name',
        'folder.description',
        'folder.permissions',
        'folder.active',
        'folder.created_by',
        'folder.shared_by',
        'folder.shared_at',
        'folder.created_at',
        'folder.updated_at',
      ]);

      if (!fetchAll) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [folders, total] = await qb.getManyAndCount();

      if (!folders || folders.length === 0) {
        return successResponse([], 'No Folders Found', 200);
      }

      const withAccess = folders.map((f) => {
        const access = this.getFolderAccess(f, user?.id);
        return {
          ...f,
          access,
          permissions: access === 'owner' ? f.permissions : undefined,
        };
      });

      const effectiveLimit = fetchAll ? -1 : limit;
      const effectivePage = fetchAll ? 0 : page;

      return successResponse(
        {
          data: withAccess,
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

  async expireDays() {
    const data = [
      { id: 1, value: 'never', label: 'Never', desc: 'No Expires' },
      { id: 2, value: '1hour', label: '1 Hour', desc: 'Expires in 1 hour' },
      { id: 3, value: '24hours', label: '24 Hours', desc: 'Expires tomorrow' },
      { id: 4, value: '1week', label: '1 Week', desc: 'Expires in 7 days' },
      { id: 5, value: '1month', label: '1 Month', desc: 'Expires in 30 days' },
    ];
    return successResponse(data, 'Expire days Fetced Successfully', 200);
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
          'shared_by',
          'shared_at',
          'created_at',
          'updated_at',
          'created_by',
        ],
      });

      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      if ((folder.deleted_by_users || []).includes(user?.id)) {
        return errorResponse('Folder Not Found', 400);
      }

      const access = this.getFolderAccess(folder, user?.id);

      if (!access) {
        return permissionDenied('view', 'folders');
      }

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'viewed',
        resource_type: 'folder',
        resource_id: folder.id,
        resource_public_id: folder.public_id,
        resource_name: folder.name,
      });

      return successResponse(
        {
          ...folder,
          access,
          permissions: access === 'owner' ? folder.permissions : undefined,
        },
        'Folder Found',
        200,
      );
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

      const hasExplicitPermissions =
        Array.isArray(body.permissions) && body.permissions.length > 0;

      const newFolder = this.folderRepo.create({
        ...body,
        permissions: body.permissions || [],
        created_by: user?.id,
        shared_by: hasExplicitPermissions ? user?.id : null,
        shared_at: hasExplicitPermissions ? new Date() : null,
      });

      const savedFolder = await this.folderRepo.save(newFolder);

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'created',
        resource_type: 'folder',
        resource_id: savedFolder.id,
        resource_public_id: savedFolder.public_id,
        resource_name: savedFolder.name,
      });

      return successResponse(savedFolder, 'Folder Created Successfully', 201);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, data: UpdateFolderDto, user: any) {
    try {
      const folder = await this.folderRepo.findOne({ where: { public_id } });
      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      const access = this.getFolderAccess(folder, user?.id);
      if (access !== 'owner' && access !== 'edit') {
        return permissionDenied('edit', 'folders');
      }

      Object.assign(folder, data);
      folder.updated_by = user?.id;

      if (access === 'owner' && data.permissions) {
        folder.shared_by = user?.id;
        folder.shared_at = new Date();
      }

      const savedFolder = await this.folderRepo.save(folder);

      if (data.permissions) {
        await this.syncItemsPermissions(folder.id, folder.permissions || []);
      }

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'updated',
        resource_type: 'folder',
        resource_id: savedFolder.id,
        resource_public_id: savedFolder.public_id,
        resource_name: savedFolder.name,
      });

      return successResponse(
        {
          ...savedFolder,
          permissions: access === 'owner' ? savedFolder.permissions : undefined,
        },
        'Folder Updated Successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async shareWithUsers(public_id: string, dto: ShareWithUsersDto, user: any) {
    try {
      const folder = await this.folderRepo.findOne({ where: { public_id } });
      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      const access = this.getFolderAccess(folder, user?.id);
      if (access !== 'owner' && access !== 'edit') {
        return permissionDenied('share', 'folders');
      }

      const existing = folder.permissions || [];
      const merged = [...existing];

      for (const entry of dto.users) {
        const idx = merged.findIndex((p) => p.user_id === entry.user_id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], access: entry.access };
        } else {
          merged.push(entry);
        }
      }

      folder.permissions = merged;
      folder.shared_by = user?.id;
      folder.shared_at = new Date();

      if (folder.deleted_by_users?.length) {
        const reSharedIds = new Set(dto.users.map((u) => u.user_id));
        folder.deleted_by_users = folder.deleted_by_users.filter(
          (id) => !reSharedIds.has(id),
        );
      }

      const savedFolder = await this.folderRepo.save(folder);
      await this.syncItemsPermissions(folder.id, merged);

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'shared_users',
        resource_type: 'folder',
        resource_id: savedFolder.id,
        resource_public_id: savedFolder.public_id,
        resource_name: savedFolder.name,
        metadata: {
          with: dto.users.map((u) => ({
            user_id: u.user_id,
            access: u.access,
          })),
        },
      });

      return successResponse(
        {
          ...savedFolder,
          permissions: access === 'owner' ? savedFolder.permissions : undefined,
        },
        'Folder shared successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const folder = await this.folderRepo.findOne({ where: { public_id } });
      if (!folder) {
        return errorResponse('Folder Not Found', 400);
      }

      const access = this.getFolderAccess(folder, user?.id);
      const hasRoleDelete = hasPermission(user?.role, 'folders', 'delete');

      if (!access && !hasRoleDelete) {
        return permissionDenied('delete', 'folders');
      }

      if (access === 'edit' || access === 'view') {
        const hiddenFor = new Set(folder.deleted_by_users || []);
        hiddenFor.add(user?.id);
        folder.deleted_by_users = Array.from(hiddenFor);
        await this.folderRepo.save(folder);

        await this.logsService.record({
          // NEW
          user_id: user?.id,
          user_email: user?.email,
          action: 'deleted',
          resource_type: 'folder',
          resource_id: folder.id,
          resource_public_id: folder.public_id,
          resource_name: folder.name,
          metadata: { scope: 'self_only' },
        });

        return successResponse(null, 'Folder removed from your account', 204);
      }

      folder.deleted_by = user?.id;
      await this.folderRepo.save(folder);
      await this.folderRepo.softDelete(folder.id);

      await this.itemRepo.update(
        { folder_id: folder.id },
        { deleted_by: user?.id },
      );
      await this.itemRepo.softDelete({ folder_id: folder.id });

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,  
        action: 'deleted',
        resource_type: 'folder',
        resource_id: folder.id,
        resource_public_id: folder.public_id,
        resource_name: folder.name,
      });

      return successResponse(null, 'Folder deleted successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }
}
