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
  if (!sharedResource.expires_at) return false;
  return new Date() > new Date(sharedResource.expires_at);
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

  //  Helpers

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

  /** Looks up a human-readable name for a shared resource (folder or item). */
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

  /** Looks up the display name of the user who created a share. */
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
    // optional item detail fields for richer audit
    username?: string;
    email?: string;
    website?: string;
  }) {
    // Super admins never trigger an audit email for their own actions —
    // the recipient of these emails IS the super admin, so an admin acting
    // on their own behalf has nothing to be notified about.
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
        "(folder.created_by = :userId OR JSON_CONTAINS(folder.permissions, :userPermission, '$'))",
        { userId: user?.id, userPermission: JSON.stringify(user?.id) },
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
      const decryptedItems = items.map((item) => ({
        ...item,
        password: this.decrypt(item.password),
      }));

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

      const hasAccess =
        item.folder.created_by === user?.id ||
        (item.folder.permissions && item.folder.permissions.includes(user?.id));

      if (!hasAccess) return permissionDenied('view', 'items');

      return successResponse(
        { ...item, password: this.decrypt(item.password) },
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
      if (!hasPermission(user?.role, 'items', 'create')) {
        return permissionDenied('create', 'items');
      }

      const newItem = this.itemRepo.create({
        name: body.name.trim(),
        username: body.username.trim(),
        email: body.email.trim(),
        website: body.website?.trim() || null,
        password: this.encrypt(body.password),
        custom_fields: body.custom_fields || [],
        notes: body.notes?.trim() || null,
        folder_id: body.folder_id,
        active: 1,
        created_by: user?.id,
      });

      const savedItem = await this.itemRepo.save(newItem);
      return successResponse(
        { ...savedItem, password: body.password },
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

      const hasEditAccess =
        item.folder.created_by === user?.id ||
        (item.folder.permissions && item.folder.permissions.includes(user?.id));

      if (!hasEditAccess) return permissionDenied('edit', 'items');

      if (data.name) item.name = data.name.trim();
      if (data.username) item.username = data.username.trim();
      if (data.email) item.email = data.email.trim();
      if (data.website !== undefined)
        item.website = data.website?.trim() || null;
      if (data.custom_fields) item.custom_fields = data.custom_fields;
      if (data.notes !== undefined) item.notes = data.notes?.trim() || null;
      if (data.folder_id) item.folder_id = data.folder_id;
      if (data.password) item.password = this.encrypt(data.password);

      item.updated_by = user?.id;
      const savedItem = await this.itemRepo.save(item);

      // Audit mail: super admins are skipped automatically inside
      // sendAuditIfNeeded; every other role's edit notifies the super admin
      // with the latest item details and who/when performed the edit.
      await this.sendAuditIfNeeded({
        action: 'edited',
        actorEmail: user?.email,
        actorUsername: user?.username || user?.email,
        actorRole: user?.role,
        itemName: savedItem.name,
        itemPublicId: savedItem.public_id,
        username: savedItem.username,
        email: savedItem.email,
        website: savedItem.website || undefined,
      });

      return successResponse(
        {
          ...savedItem,
          password: data.password
            ? data.password
            : this.decrypt(savedItem.password),
        },
        'Item Updated Successfully',
        200,
      );
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
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

      const hasAccess =
        item.folder.created_by === user?.id ||
        (item.folder.permissions && item.folder.permissions.includes(user?.id));

      if (!hasAccess) return permissionDenied('copy', 'items');

      // Audit mail: super admins are skipped automatically inside
      // sendAuditIfNeeded; every other role's copy notifies the super admin
      // with the item's details and who/when performed the copy.
      await this.sendAuditIfNeeded({
        action: 'copied',
        actorEmail: user?.email,
        actorUsername: user?.username || user?.email,
        actorRole: user?.role,
        itemName: item.name,
        itemPublicId: item.public_id,
        username: item.username,
        email: item.email,
        website: item.website || undefined,
      });

      return successResponse(
        { ...item, password: this.decrypt(item.password) },
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

      if (
        !hasPermission(user?.role, 'items', 'delete') &&
        item.folder.created_by !== user?.id
      ) {
        return permissionDenied('delete', 'items');
      }

      item.deleted_by = user?.id;
      await this.itemRepo.save(item);
      await this.itemRepo.softDelete(item.id);

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

      const hasAccess = items.every(
        (item) =>
          hasPermission(user?.role, 'items', 'delete') ||
          item.folder.created_by === user?.id,
      );

      if (!hasAccess) return permissionDenied('delete', 'items');

      await this.itemRepo.softDelete({ public_id: In(public_ids) });
      await this.itemRepo.update(
        { public_id: In(public_ids) },
        { deleted_by: user?.id },
      );

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

  // ── Share flow ─────────────────────────────────────────────────────────────

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

      // No OTP is generated here anymore. Every access attempt — public or
      // personal — gets a fresh OTP generated and emailed at the email-gate
      // step (checkShareEmail), scoped to the person checking in right then.
      const newShare = this.sharedResourceRepo.create({
        resource_type: shareDto.resource_type,
        folder_id:
          shareDto.resource_type === 'folder' ? resource.id : undefined,
        item_id: shareDto.resource_type === 'item' ? resource.id : undefined,
        permission_type: shareDto.permission_type,
        visibility: shareDto.visibility,
        shared_with: sharedWithPayload,
        share_token: shareToken,
        // otp / otp_expire_at intentionally omitted — no OTP exists yet at
        // creation time, it's generated lazily in checkShareEmail(). Passing
        // `null` fails type-checking since the entity declares these as
        // `string | undefined`, not nullable; omitting leaves them undefined.
        is_otp_verified: false,
        expires_at: expiresAt ?? undefined,
        created_by: user?.id,
      });

      await this.sharedResourceRepo.save(newShare);
      const shareLink = `${process.env.APP_URL}/share/${shareToken}`;

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

  /**
   * Email gate — step 0 of access. Validates the email against the right
   * scope (any registered user for public links, only the chosen recipients
   * for personal links), then issues a fresh OTP and emails it to that
   * person. Always requires OTP, for both visibilities.
   */
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
        // Public: validated against any registered user in the system.
        if (!user) {
          return errorResponse(
            'Your email is not registered in this system',
            403,
          );
        }
        permission = sharedResource.permission_type;
      } else {
        // Personal: validated ONLY against the specifically shared
        // recipients — never against the full user list.
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

      // Generate and email a fresh OTP for this access attempt.
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

      // ── Fetch resource
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
        if (resource?.password)
          resource.password = this.decrypt(resource.password);
        resourceName = resource?.name || `Item #${sharedResource.item_id}`;
      }

      // Audit the access itself for personal shares (matches prior
      // behavior); public access auditing happens the same way since both
      // now flow through this single verify step.
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
          'active',
        ],
      });

      return successResponse(
        {
          data: items.map((item) => ({
            ...item,
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
}
