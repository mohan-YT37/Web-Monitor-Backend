// items.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import { Item } from './entities/item.entity';
import { Folder } from './entities/folder.entity';
import {
  SharedResource,
  SharedUserPermission,
} from './entities/shared-resource.entity';
import { User } from 'src/users/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import {
  errorResponse,
  permissionDenied,
  successResponse,
} from 'src/common/response/response.util';
import { CatchError } from 'src/common/response/error.utils';
import { CreateItemDto } from './dto/create-item.dto';
import { hasPermission } from 'src/common/helper/menu.permission.helper';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  ShareResourceDto,
  VerifyShareOtpDto,
  CheckShareEmailDto,
  ExpireOption,
} from './dto/share-resource.dto';
import { ShareWithUsersDto } from './dto/share-with-users.dto';
import { FolderPermissionEntry } from './interfaces/folder-permission.interface';
import { LogsService } from '../password-logs/password-logs.service';

function computeExpiresAt(expires_in?: ExpireOption): Date | null {
  if (!expires_in || expires_in === 'never') return null;
  const now = new Date();
  switch (expires_in) {
    case '1hour':
      return new Date(now.getTime() + 1 * 60 * 60 * 1000);
    case '24hours':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '1week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '1month':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function isExpired(sharedResource: SharedResource): boolean {
  if (!sharedResource.expires_at) {
    return false;
  }
  return new Date() > new Date(sharedResource.expires_at);
}

function mergePermissions(
  folderPermissions: FolderPermissionEntry[] = [],
  explicitEntries: FolderPermissionEntry[] = [],
): FolderPermissionEntry[] {
  const merged = [...folderPermissions];
  for (const entry of explicitEntries) {
    const idx = merged.findIndex((p) => p.user_id === entry.user_id);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], access: entry.access };
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

@Injectable()
export class ItemsService {
  private readonly ENCRYPTION_KEY: Buffer;
  private readonly IV_LENGTH = 16;

  constructor(
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    @InjectRepository(Folder)
    private folderRepo: Repository<Folder>,
    @InjectRepository(SharedResource)
    private sharedResourceRepo: Repository<SharedResource>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private mailService: MailService,
    private logsService: LogsService,
  ) {
    const keyFromEnv = process.env.ENCRYPTION_KEY;
    if (!keyFromEnv)
      throw new Error('ENCRYPTION_KEY environment variable is required');
    if (keyFromEnv.length === 64 && /^[0-9a-fA-F]+$/.test(keyFromEnv)) {
      this.ENCRYPTION_KEY = Buffer.from(keyFromEnv, 'hex');
    } else {
      this.ENCRYPTION_KEY = Buffer.from(keyFromEnv, 'base64');
    }
    if (this.ENCRYPTION_KEY.length !== 32) {
      throw new Error(
        `Invalid encryption key length: ${this.ENCRYPTION_KEY.length}. Expected 32 bytes.`,
      );
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.ENCRYPTION_KEY,
      iv,
    );
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.ENCRYPTION_KEY,
      iv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  private safeDecrypt(text: string): string {
    if (!text) return text;
    try {
      return this.decrypt(text);
    } catch {
      return text;
    }
  }

  private getItemAccess(
    item: Item,
    userId: number,
  ): 'owner' | 'edit' | 'view' | null {
    if (item.folder?.created_by === userId) return 'owner';
    const list: FolderPermissionEntry[] = item.permissions?.length
      ? item.permissions
      : item.folder?.permissions || [];
    const entry = list.find((p) => p.user_id === userId);
    return entry ? entry.access : null;
  }

  private async resolveResourceName(
    sharedResource: SharedResource,
  ): Promise<string> {
    if (sharedResource.resource_type === 'folder') {
      const folder = await this.folderRepo.findOne({
        where: { id: sharedResource.folder_id },
        select: ['name'],
      });
      return folder?.name || `Folder #${sharedResource.folder_id}`;
    }
    const item = await this.itemRepo.findOne({
      where: { id: sharedResource.item_id },
      select: ['name'],
    });
    return item?.name || `Item #${sharedResource.item_id}`;
  }

  private async resolveOwnerName(ownerId: number): Promise<string> {
    const owner = await this.userRepo.findOne({
      where: { id: ownerId },
      select: ['username', 'email'],
    });
    return owner?.username || owner?.email || 'Someone';
  }

  private async sendAuditIfNeeded(context: {
    action: 'edited' | 'copied' | 'accessed';
    actorEmail: string;
    actorUsername: string;
    actorRole: string;
    itemName: string;
    itemPublicId: string;
    username?: string;
    email?: string;
    website?: string;
  }) {
    if (context.actorRole === 'super_admin') return;

    try {
      const superAdmin = await this.userRepo.findOne({
        where: { role: 'super_admin' },
        select: ['email', 'username'],
      });

      if (!superAdmin?.email) return;

      await this.mailService.sendItemAuditEmail(superAdmin.email, {
        action: context.action,
        performedBy: context.actorEmail,
        performedByName: context.actorUsername,
        itemName: context.itemName,
        itemPublicId: context.itemPublicId,
        timestamp: new Date().toISOString(),
        username: context.username,
        email: context.email,
        website: context.website,
      });
    } catch (mailErr) {
      console.error('Audit email failed (non-fatal):', mailErr);
    }
  }

  async findAll(
    query?: {
      search?: string;
      filter?: string;
      sort?: string;
      page?: number;
      limit?: number;
      folder_id?: number;
    },
    user?: any,
  ) {
    try {
      const page = Number(query?.page ?? 0);
      const limit = Number(query?.limit ?? -1);
      const fetchAll = page <= 0 || limit <= 0;

      const qb = this.itemRepo
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.folder', 'folder');

      if (query?.folder_id) {
        qb.andWhere('item.folder_id = :folderId', {
          folderId: query.folder_id,
        });
      }

      qb.andWhere(
        "(folder.created_by = :userId OR JSON_CONTAINS(JSON_EXTRACT(item.permissions, '$[*].user_id'), CAST(:userId AS JSON)))",
        { userId: user?.id },
      );

      qb.andWhere(
        '(item.deleted_by_users IS NULL OR NOT FIND_IN_SET(:hideUserId, item.deleted_by_users)) AND (folder.deleted_by_users IS NULL OR NOT FIND_IN_SET(:hideUserId, folder.deleted_by_users))',
        { hideUserId: user?.id },
      );

      if (query?.search) {
        qb.andWhere(
          '(item.name LIKE :search OR item.username LIKE :search OR item.website LIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('item.active = :active', { active: 1 });
            break;
          case 'INACTIVE':
            qb.andWhere('item.active = :active', { active: 0 });
            break;
        }
      }

      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('item.name', 'ASC');
            break;
          case 'Z_A':
            qb.orderBy('item.name', 'DESC');
            break;
          case 'OLDEST':
            qb.orderBy('item.created_at', 'ASC');
            break;
          default:
            qb.orderBy('item.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('item.created_at', 'DESC');
      }

      if (!fetchAll) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [items, total] = await qb.getManyAndCount();

      const decryptedItems = items.map((item) => {
        const access = this.getItemAccess(item, user?.id);
        return {
          ...item,
          username: this.safeDecrypt(item.username),
          password: this.decrypt(item.password),
          access,
          permissions: access === 'owner' ? item.permissions : undefined,
        };
      });

      if (!decryptedItems || decryptedItems.length === 0) {
        return successResponse([], 'No Items Found', 200);
      }

      const effectiveLimit = fetchAll ? -1 : limit;
      const effectivePage = fetchAll ? 0 : page;

      return successResponse(
        {
          data: decryptedItems,
          pagination: {
            total,
            page: effectivePage,
            limit: effectiveLimit,
            totalPages: fetchAll ? 1 : Math.ceil(total / effectiveLimit),
          },
        },
        'Items fetched successfully',
        200,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      return CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {

      const item = await this.itemRepo.findOne({
        where: { public_id },
        relations: ['folder'],
      });

      if (!item) return errorResponse('Item Not Found', 400);

      const hiddenForUser =
        (item.deleted_by_users || []).includes(user?.id) ||
        (item.folder?.deleted_by_users || []).includes(user?.id);
      if (hiddenForUser) return errorResponse('Item Not Found', 400);

      const access = this.getItemAccess(item, user?.id);
      if (!access) return permissionDenied('view', 'items');

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'viewed',
        resource_type: 'item',
        resource_id: item.id,
        resource_public_id: item.public_id,
        resource_name: item.name,
      });

      return successResponse(
        {
          ...item,
          username: this.safeDecrypt(item.username),
          password: this.decrypt(item.password),
          access,
          permissions: access === 'owner' ? item.permissions : undefined,
        },
        'Item Found',
        200,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      return CatchError(error);
    }
  }

  async create(body: CreateItemDto, user: any) {
    try {

      const folder = await this.folderRepo.findOne({
        where: { id: body.folder_id },
      });
      if (!folder) return errorResponse('Folder Not Found', 400);

      const folderAccess =
        folder.created_by === user?.id
          ? 'owner'
          : (folder.permissions || []).find((p) => p.user_id === user?.id)
              ?.access || null;

      if (folderAccess !== 'owner' && folderAccess !== 'edit') {
        return permissionDenied('create', 'items');
      }

      const plainUsername = body.username.trim();
      const hasExplicitPermissions =
        Array.isArray(body.permissions) && body.permissions.length > 0;

      const itemPermissions = hasExplicitPermissions
        ? mergePermissions(folder.permissions || [], body.permissions)
        : folder.permissions || [];

      const newItem = this.itemRepo.create({
        name: body.name.trim(),
        username: this.encrypt(plainUsername),
        email: body.email.trim(),
        website: body.website?.trim() || null,
        password: this.encrypt(body.password),
        custom_fields: body.custom_fields || [],
        tags: body.tags || [],
        notes: body.notes?.trim() || null,
        folder_id: body.folder_id,
        permissions: itemPermissions,
        shared_by: hasExplicitPermissions ? user?.id : null,
        shared_at: hasExplicitPermissions ? new Date() : null,
        active: 1,
        created_by: user?.id,
      });

      const savedItem = await this.itemRepo.save(newItem);

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'created',
        resource_type: 'item',
        resource_id: savedItem.id,
        resource_public_id: savedItem.public_id,
        resource_name: savedItem.name,
      });

      return successResponse(
        {
          ...savedItem,
          username: plainUsername,
          password: body.password,
        },
        'Item Created Successfully',
        201,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : error);
      return CatchError(error);
    }
  }

  async update(public_id: string, data: UpdateItemDto, user: any) {
    try {
 
      const item = await this.itemRepo.findOne({
        where: { public_id },
        relations: ['folder'],
      });

      if (!item) return errorResponse('Item Not Found', 400);

      const access = this.getItemAccess(item, user?.id);
      if (access !== 'owner' && access !== 'edit') {
        return permissionDenied('edit', 'items');
      }

      if (data.name) item.name = data.name.trim();
      if (data.username) item.username = this.encrypt(data.username.trim());
      if (data.email) item.email = data.email.trim();
      if (data.website !== undefined)
        item.website = data.website?.trim() || null;
      if (data.custom_fields) item.custom_fields = data.custom_fields;
      if (data.tags) item.tags = data.tags;
      if (data.notes !== undefined) item.notes = data.notes?.trim() || null;
      if (data.password) item.password = this.encrypt(data.password);

      if (data.folder_id && data.folder_id !== item.folder_id) {
        const previousFolderName = item.folder?.name;
        const targetFolder = await this.folderRepo.findOne({
          where: { id: data.folder_id },
        });
        if (!targetFolder) return errorResponse('Target Folder Not Found', 400);

        const targetAccess =
          targetFolder.created_by === user?.id
            ? 'owner'
            : (targetFolder.permissions || []).find(
                (p) => p.user_id === user?.id,
              )?.access || null;

        if (targetAccess !== 'owner' && targetAccess !== 'edit') {
          return permissionDenied('move', 'items');
        }

        item.folder = targetFolder;
        item.folder_id = targetFolder.id;

        const explicitOnly = (item.permissions || []).filter(
          (p) =>
            !(targetFolder.permissions || []).some(
              (fp) => fp.user_id === p.user_id,
            ) &&
            !(item.folder?.permissions || []).some(
              (fp) => fp.user_id === p.user_id,
            ),
        );
        item.permissions = mergePermissions(
          targetFolder.permissions || [],
          explicitOnly,
        );

        await this.logsService.record({
          user_id: user?.id,
          user_email: user?.email,
          action: 'moved',
          resource_type: 'item',
          resource_id: item.id,
          resource_public_id: item.public_id,
          resource_name: item.name,
          metadata: { from: previousFolderName, to: targetFolder.name },
        });
      }

      if (access === 'owner' && data.permissions) {
        item.permissions = mergePermissions(
          item.folder?.permissions || [],
          data.permissions,
        );
        item.shared_by = user?.id;
        item.shared_at = new Date();
      }

      item.updated_by = user?.id;

      const savedItem = await this.itemRepo.save(item);

      const plainUsername = data.username
        ? data.username.trim()
        : this.safeDecrypt(savedItem.username);

      await this.sendAuditIfNeeded({
        action: 'edited',
        actorEmail: user?.email,
        actorUsername: user?.username || user?.email,
        actorRole: user?.role,
        itemName: savedItem.name,
        itemPublicId: savedItem.public_id,
        username: plainUsername,
        email: savedItem.email,
        website: savedItem.website || undefined,
      });

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'updated',
        resource_type: 'item',
        resource_id: savedItem.id,
        resource_public_id: savedItem.public_id,
        resource_name: savedItem.name,
      });

      return successResponse(
        {
          ...savedItem,
          username: plainUsername,
          password: data.password
            ? data.password
            : this.decrypt(savedItem.password),
          permissions: access === 'owner' ? savedItem.permissions : undefined,
        },
        'Item Updated Successfully',
        200,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      return CatchError(error);
    }
  }

  async shareWithUsers(public_id: string, dto: ShareWithUsersDto, user: any) {
    try {
      const item = await this.itemRepo.findOne({
        where: { public_id },
        relations: ['folder'],
      });
      if (!item) return errorResponse('Item Not Found', 400);

      const access = this.getItemAccess(item, user?.id);
      if (access !== 'owner' && access !== 'edit') {
        return permissionDenied('share', 'items');
      }

      const existing = item.permissions || [];
      const merged = [...existing];

      for (const entry of dto.users) {
        const idx = merged.findIndex((p) => p.user_id === entry.user_id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], access: entry.access };
        } else {
          merged.push(entry);
        }
      }

      item.permissions = merged;
      item.shared_by = user?.id;
      item.shared_at = new Date();

      if (item.deleted_by_users?.length) {
        const reSharedIds = new Set(dto.users.map((u) => u.user_id));
        item.deleted_by_users = item.deleted_by_users.filter(
          (id) => !reSharedIds.has(id),
        );
      }

      const savedItem = await this.itemRepo.save(item);

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'shared_users',
        resource_type: 'item',
        resource_id: savedItem.id,
        resource_public_id: savedItem.public_id,
        resource_name: savedItem.name,
        metadata: {
          with: dto.users.map((u) => ({
            user_id: u.user_id,
            access: u.access,
          })),
        },
      });

      return successResponse(
        {
          ...savedItem,
          permissions: access === 'owner' ? savedItem.permissions : undefined,
        },
        'Item shared successfully',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async copyItem(public_id: string, user: any) {
    try {
      const item = await this.itemRepo.findOne({
        where: { public_id },
        relations: ['folder'],
      });

      if (!item) return errorResponse('Item Not Found', 400);

      const access = this.getItemAccess(item, user?.id);
      if (!access) return permissionDenied('copy', 'items');

      const plainUsername = this.safeDecrypt(item.username);

      await this.sendAuditIfNeeded({
        action: 'copied',
        actorEmail: user?.email,
        actorUsername: user?.username || user?.email,
        actorRole: user?.role,
        itemName: item.name,
        itemPublicId: item.public_id,
        username: plainUsername,
        email: item.email,
        website: item.website || undefined,
      });

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'copied',
        resource_type: 'item',
        resource_id: item.id,
        resource_public_id: item.public_id,
        resource_name: item.name,
      });

      return successResponse(
        {
          ...item,
          username: plainUsername,
          password: this.decrypt(item.password),
          permissions: access === 'owner' ? item.permissions : undefined,
        },
        'Item data fetched for copy',
        200,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const item = await this.itemRepo.findOne({
        where: { public_id },
        relations: ['folder'],
      });

      if (!item) return errorResponse('Item Not Found', 400);

      const access = this.getItemAccess(item, user?.id);
      const hasRoleDelete = hasPermission(user?.role, 'items', 'delete');

      if (
        !hasRoleDelete &&
        access !== 'owner' &&
        access !== 'edit' &&
        access !== 'view'
      ) {
        return permissionDenied('delete', 'items');
      }

      if (access === 'edit' || access === 'view') {
        const hiddenFor = new Set(item.deleted_by_users || []);
        hiddenFor.add(user?.id);
        item.deleted_by_users = Array.from(hiddenFor);
        await this.itemRepo.save(item);

        await this.logsService.record({
          user_id: user?.id,
          user_email: user?.email,
          action: 'deleted',
          resource_type: 'item',
          resource_id: item.id,
          resource_public_id: item.public_id,
          resource_name: item.name,
          metadata: { scope: 'self_only' },
        });

        return successResponse(null, 'Item removed from your account', 204);
      }

      item.deleted_by = user?.id;
      await this.itemRepo.save(item);
      await this.itemRepo.softDelete(item.id);

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'deleted',
        resource_type: 'item',
        resource_id: item.id,
        resource_public_id: item.public_id,
        resource_name: item.name,
      });

      return successResponse(null, 'Item deleted successfully', 204);
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      return CatchError(error);
    }
  }

  async bulkRemove(public_ids: string[], user: any) {
    try {

      if (!public_ids || public_ids.length === 0) {
        return errorResponse('No items selected for deletion', 400);
      }

      const items = await this.itemRepo.find({
        where: { public_id: In(public_ids) },
        relations: ['folder'],
      });

      if (items.length === 0) return errorResponse('No items found', 404);

      const hasRoleDelete = hasPermission(user?.role, 'items', 'delete');

      const itemsWithAccess = items.map((item) => ({
        item,
        access: this.getItemAccess(item, user?.id),
      }));

      const hasAccess = itemsWithAccess.every(
        ({ access }) =>
          hasRoleDelete ||
          access === 'owner' ||
          access === 'edit' ||
          access === 'view',
      );

      if (!hasAccess) return permissionDenied('delete', 'items');

      const hardDeleteIds: string[] = [];
      const hideOnlyItems: Item[] = [];

      for (const { item, access } of itemsWithAccess) {
        if (access === 'edit' || access === 'view') {
          hideOnlyItems.push(item);
        } else {
          hardDeleteIds.push(item.public_id);
        }
      }

      if (hideOnlyItems.length > 0) {
        await Promise.all(
          hideOnlyItems.map((item) => {
            const hiddenFor = new Set(item.deleted_by_users || []);
            hiddenFor.add(user?.id);
            item.deleted_by_users = Array.from(hiddenFor);
            return this.itemRepo.save(item);
          }),
        );
        await Promise.all(
          hideOnlyItems.map((item) =>
            this.logsService.record({
              user_id: user?.id,
              user_email: user?.email,
              action: 'deleted',
              resource_type: 'item',
              resource_id: item.id,
              resource_public_id: item.public_id,
              resource_name: item.name,
              metadata: { scope: 'self_only', bulk: true },
            }),
          ),
        );
      }

      if (hardDeleteIds.length > 0) {
        await this.itemRepo.softDelete({ public_id: In(hardDeleteIds) });
        await this.itemRepo.update(
          { public_id: In(hardDeleteIds) },
          { deleted_by: user?.id },
        );
        const hardDeleted = items.filter((i) =>
          hardDeleteIds.includes(i.public_id),
        );
        await Promise.all(
          hardDeleted.map((item) =>
            this.logsService.record({
              user_id: user?.id,
              user_email: user?.email,
              action: 'deleted',
              resource_type: 'item',
              resource_id: item.id,
              resource_public_id: item.public_id,
              resource_name: item.name,
              metadata: { bulk: true },
            }),
          ),
        );
      }

      return successResponse(
        { deleted_count: items.length },
        `${items.length} item(s) deleted successfully`,
        200,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      return CatchError(error);
    }
  }

  async shareResource(
    resourcePublicId: string,
    shareDto: ShareResourceDto,
    user: any,
  ) {
    try {
      if (!hasPermission(user?.role, 'share', 'create')) {
        return permissionDenied('share', 'resources');
      }

      let resource: any;
      if (shareDto.resource_type === 'folder') {
        resource = await this.folderRepo.findOne({
          where: { public_id: resourcePublicId },
        });
      } else {
        resource = await this.itemRepo.findOne({
          where: { public_id: resourcePublicId },
          relations: ['folder'],
        });
      }

      if (!resource) return errorResponse('Resource not found', 404);
      if (resource.created_by !== user?.id)
        return permissionDenied('share', 'resources');

      if (shareDto.visibility === 'personal' && shareDto.shared_with?.length) {
        const userIds = shareDto.shared_with.map((u) => u.id);
        const resolvedUsers = await this.userRepo.findByIds(userIds);
        if (resolvedUsers.length !== userIds.length) {
          return errorResponse('One or more selected users not found', 400);
        }
      }

      const shareToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = computeExpiresAt(shareDto.expires_in);

      const sharedWithPayload: SharedUserPermission[] =
        shareDto.visibility === 'personal' && shareDto.shared_with?.length
          ? shareDto.shared_with.map((u) => ({
              id: u.id,
              permission: u.permission,
            }))
          : [];

      const newShare = this.sharedResourceRepo.create({
        resource_type: shareDto.resource_type,
        folder_id:
          shareDto.resource_type === 'folder' ? resource.id : undefined,
        item_id: shareDto.resource_type === 'item' ? resource.id : undefined,
        permission_type: shareDto.permission_type,
        visibility: shareDto.visibility,
        shared_with: sharedWithPayload,
        share_token: shareToken,
        is_otp_verified: false,
        expires_at: expiresAt ?? undefined,
        created_by: user?.id,
      });

      await this.sharedResourceRepo.save(newShare);
      const shareLink = `${process.env.APP_URL}/share/${shareToken}`;

      await this.logsService.record({
        user_id: user?.id,
        user_email: user?.email,
        action: 'shared_link',
        resource_type: shareDto.resource_type,
        resource_id: resource.id,
        resource_public_id: resource.public_id,
        resource_name: resource.name,
        metadata: {
          visibility: shareDto.visibility,
          permission_type: shareDto.permission_type,
          expires_in: shareDto.expires_in,
        },
      });

      return successResponse(
        {
          share_link: shareLink,
          share_token: shareToken,
          expires_at: expiresAt,
        },
        'Resource shared successfully',
        201,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async checkShareEmail(dto: CheckShareEmailDto) {
    try {
      const sharedResource = await this.sharedResourceRepo.findOne({
        where: { share_token: dto.share_token, active: 1 },
      });

      if (!sharedResource) return errorResponse('Invalid share link', 400);
      if (isExpired(sharedResource))
        return errorResponse('This share link has expired', 410);

      const user = await this.userRepo.findOne({
        where: { email: dto.email },
        select: ['id', 'email', 'username', 'role'],
      });

      let permission: string;

      if (sharedResource.visibility === 'public') {
        if (!user) {
          return errorResponse(
            'Your email is not registered in this system',
            403,
          );
        }
        permission = sharedResource.permission_type;
      } else {
        const sharedUsers = sharedResource.shared_with || [];
        if (sharedUsers.length === 0) {
          return errorResponse(
            'No users have been granted access to this link',
            403,
          );
        }
        if (!user) {
          return errorResponse(
            'Your email does not have access to this resource',
            403,
          );
        }
        const userEntry = sharedUsers.find((u) => u.id === user.id);
        if (!userEntry) {
          return errorResponse(
            'Your email does not have access to this resource',
            403,
          );
        }
        permission = userEntry.permission;
      }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

      sharedResource.otp = otp;
      sharedResource.otp_expire_at = otpExpiry;
      sharedResource.is_otp_verified = false;
      await this.sharedResourceRepo.save(sharedResource);

      const resourceName = await this.resolveResourceName(sharedResource);
      const ownerName = await this.resolveOwnerName(sharedResource.created_by);

      try {
        await this.mailService.sendShareOtpEmail(user.email, {
          userName: user.username || user.email,
          sharedBy: ownerName,
          resourceName,
          resourceType: sharedResource.resource_type,
          permissionType: permission,
          otp,
          shareLink: `${process.env.APP_URL}/share/${sharedResource.share_token}`,
        });
      } catch (err) {
        console.error(`Failed to send OTP email to ${user.email}:`, err);
      }

      return successResponse(
        {
          can_access: true,
          needs_otp: true,
          permission,
          visibility: sharedResource.visibility,
          user_id: user.id,
        },
        'OTP sent to your email',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async verifyShareOtp(verifyDto: VerifyShareOtpDto) {
    try {
      const sharedResource = await this.sharedResourceRepo.findOne({
        where: { share_token: verifyDto.share_token, otp: verifyDto.otp },
      });

      if (!sharedResource)
        return errorResponse('Invalid OTP or share token', 400);
      if (isExpired(sharedResource))
        return errorResponse('This share link has expired', 410);
      if (
        sharedResource.otp_expire_at &&
        new Date() > sharedResource.otp_expire_at
      ) {
        return errorResponse('OTP has expired', 400);
      }

      sharedResource.is_otp_verified = true;
      await this.sharedResourceRepo.save(sharedResource);

      let resource: any;
      let resourceName = '';

      if (sharedResource.resource_type === 'folder') {
        resource = await this.folderRepo.findOne({
          where: { id: sharedResource.folder_id },
        });
        resourceName = resource?.name || `Folder #${sharedResource.folder_id}`;
      } else {
        resource = await this.itemRepo.findOne({
          where: { id: sharedResource.item_id },
        });
        if (resource?.username)
          resource.username = this.safeDecrypt(resource.username);
        if (resource?.password)
          resource.password = this.decrypt(resource.password);
        resourceName = resource?.name || `Item #${sharedResource.item_id}`;
      }

      const sharedWithIds = (sharedResource.shared_with || []).map((u) => u.id);

      if (sharedWithIds.length > 0) {
        const accessors = await this.userRepo.find({
          where: { id: In(sharedWithIds) },
          select: ['id', 'email', 'username', 'role'],
        });

        for (const accessor of accessors) {
          await this.sendAuditIfNeeded({
            action: 'accessed',
            actorEmail: accessor.email,
            actorUsername: accessor.username || accessor.email,
            actorRole: accessor.role,
            itemName: resourceName,
            itemPublicId: sharedResource.share_token,
          });
        }
      }

      return successResponse(
        {
          resource,
          permission_type: sharedResource.permission_type,
          resource_type: sharedResource.resource_type,
          shared_with: sharedResource.shared_with,
          visibility: sharedResource.visibility,
          expires_at: sharedResource.expires_at,
        },
        'OTP verified successfully',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async accessSharedResource(shareToken: string) {
    try {
      const sharedResource = await this.sharedResourceRepo.findOne({
        where: { share_token: shareToken, active: 1 },
      });

      if (!sharedResource)
        return errorResponse('Invalid or expired share link', 400);
      if (isExpired(sharedResource))
        return errorResponse('This share link has expired', 410);
      if (!sharedResource.is_otp_verified) {
        return errorResponse('OTP verification required', 403);
      }

      let resource: any;
      if (sharedResource.resource_type === 'folder') {
        resource = await this.folderRepo.findOne({
          where: { id: sharedResource.folder_id },
        });
      } else {
        resource = await this.itemRepo.findOne({
          where: { id: sharedResource.item_id },
          relations: ['folder'],
        });
        if (resource?.username)
          resource.username = this.safeDecrypt(resource.username);
        if (resource?.password)
          resource.password = this.decrypt(resource.password);
      }

      if (!resource) return errorResponse('Resource not found', 404);

      return successResponse(
        {
          resource,
          permission_type: sharedResource.permission_type,
          resource_type: sharedResource.resource_type,
          shared_with: sharedResource.shared_with,
          visibility: sharedResource.visibility,
          expires_at: sharedResource.expires_at,
        },
        'Resource accessed successfully',
        200,
      );
    } catch (error) {
      return CatchError(error);
    }
  }

  async accessSharedFolderItems(shareToken: string) {
    try {
      const sharedResource = await this.sharedResourceRepo.findOne({
        where: { share_token: shareToken, resource_type: 'folder', active: 1 },
      });

      if (!sharedResource)
        return errorResponse('Invalid or expired share link', 400);
      if (isExpired(sharedResource))
        return errorResponse('This share link has expired', 410);
      if (!sharedResource.is_otp_verified) {
        return errorResponse('OTP verification required', 403);
      }

      const items = await this.itemRepo.find({
        where: { folder_id: sharedResource.folder_id },
        select: [
          'id',
          'public_id',
          'name',
          'username',
          'email',
          'website',
          'password',
          'notes',
          'custom_fields',
          'tags',
          'active',
        ],
      });

      return successResponse(
        {
          data: items.map((item) => ({
            ...item,
            username: this.safeDecrypt(item.username),
            password: this.decrypt(item.password),
          })),
          permission_type: sharedResource.permission_type,
          shared_with: sharedResource.shared_with,
          visibility: sharedResource.visibility,
        },
        'Folder items fetched successfully',
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
