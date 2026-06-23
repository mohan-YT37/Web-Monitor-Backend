import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './entities/password-log.entity';
import { CreateLogDto } from './dto/create-password-log.dto';
import { successResponse } from 'src/common/response/response.util';
import { CatchError } from 'src/common/response/error.utils';
import { LogAction, LogResourceType } from 'src/common/enum/log.enum';
import { User } from 'src/users/entities/user.entity';

const ACTION_VERBS: Record<LogAction, string> = {
  viewed: 'viewed',
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  copied: 'copied the info of',
  shared_link: 'shared a link for',
  shared_users: 'shared',
  moved: 'moved',
};

function buildDescription(
  actorLabel: string,
  action: LogAction,
  resourceType: LogResourceType,
  resourceName: string,
  metadata?: Record<string, any> | null,
): string {
  const verb = ACTION_VERBS[action] || action;
  const base = `${actorLabel} ${verb} the ${resourceType} "${resourceName}"`;

  if (action === 'shared_users' && metadata?.with?.length) {
    const names = metadata.with
      .map((w: any) => w.user_name || w.user_email || `User #${w.user_id}`)
      .join(', ');
    return `${base} with ${names}`;
  }
  if (action === 'shared_link' && metadata?.visibility) {
    return `${base} as a ${metadata.visibility} link`;
  }
  if (action === 'moved' && metadata?.from && metadata?.to) {
    return `${base} from "${metadata.from}" to "${metadata.to}"`;
  }
  if (action === 'deleted' && metadata?.scope === 'self_only') {
    return `${base} (removed from their own account only)`;
  }
  return base;
}

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(Log)
    private logRepo: Repository<Log>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}


  private async resolveUserName(
    userId?: number,
    fallbackEmail?: string,
  ): Promise<string | undefined> {
    if (!userId) return fallbackEmail;
    try {
      const u = await this.userRepo.findOne({
        where: { id: userId },
        select: ['username', 'email'],
      });
      return u?.username || u?.email || fallbackEmail;
    } catch {
      return fallbackEmail;
    }
  }

  async record(dto: CreateLogDto): Promise<void> {
    try {
      const resolvedUserName =
        dto.user_name ||
        (await this.resolveUserName(dto.user_id, dto.user_email));

      const actorLabel = resolvedUserName || dto.user_email || 'Someone';

      const description =
        dto.description ||
        buildDescription(
          actorLabel,
          dto.action,
          dto.resource_type,
          dto.resource_name || `#${dto.resource_id ?? ''}`,
          dto.metadata,
        );

      const log = this.logRepo.create({
        user_id: dto.user_id,
        user_name: resolvedUserName,
        user_email: dto.user_email,
        action: dto.action,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
        resource_public_id: dto.resource_public_id,
        resource_name: dto.resource_name,
        description,
        metadata: dto.metadata || null,
      });

      await this.logRepo.save(log);
    } catch (error) {
      console.error('Log write failed (non-fatal):', error);
    }
  }

  async findAll(query?: {
    search?: string;
    filter?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = query?.page ? Number(query.page) : 0;
      const limit = query?.limit ? Number(query.limit) : -1;
      const fetchAll = page <= 0 || limit <= 0;

      const qb = this.logRepo.createQueryBuilder('log');

      if (query?.search) {
        qb.andWhere(
          '(log.user_name LIKE :search OR log.user_email LIKE :search OR log.resource_name LIKE :search OR log.description LIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      if (query?.filter) {
        const f = query.filter.toUpperCase();
        if (f === 'ITEM' || f === 'FOLDER') {
          qb.andWhere('log.resource_type = :rt', { rt: f.toLowerCase() });
        } else if (
          [
            'VIEWED',
            'CREATED',
            'UPDATED',
            'DELETED',
            'COPIED',
            'SHARED_LINK',
            'SHARED_USERS',
            'MOVED',
          ].includes(f)
        ) {
          qb.andWhere('log.action = :action', { action: f.toLowerCase() });
        }
      }

      if (query?.sort?.toUpperCase() === 'OLDEST') {
        qb.orderBy('log.created_at', 'ASC');
      } else {
        qb.orderBy('log.created_at', 'DESC');
      }

      if (!fetchAll) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [logs, total] = await qb.getManyAndCount();

      const effectiveLimit = fetchAll ? -1 : limit;
      const effectivePage = fetchAll ? 0 : page;

      return successResponse(
        {
          data: logs,
          pagination: {
            total,
            page: effectivePage,
            limit: effectiveLimit,
            totalPages: fetchAll ? 1 : Math.ceil(total / effectiveLimit),
          },
        },
        'Logs fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string) {
    try {
      const log = await this.logRepo.findOne({ where: { public_id } });
      if (!log) {
        return { status: false, message: 'Log not found', statusCode: 404 };
      }
      return successResponse(log, 'Log fetched successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async getFilters() {
    return successResponse(
      [
        { id: 1, value: '', label: 'All' },
        { id: 2, value: 'ITEM', label: 'Items' },
        { id: 3, value: 'FOLDER', label: 'Folders' },
        { id: 4, value: 'VIEWED', label: 'Viewed' },
        { id: 5, value: 'CREATED', label: 'Created' },
        { id: 6, value: 'UPDATED', label: 'Updated' },
        { id: 7, value: 'DELETED', label: 'Deleted' },
        { id: 8, value: 'COPIED', label: 'Copied' },
        { id: 9, value: 'SHARED_LINK', label: 'Shared as Link' },
        { id: 10, value: 'SHARED_USERS', label: 'Shared with Users' },
        { id: 11, value: 'MOVED', label: 'Moved' },
      ],
      'Filter options fetched successfully',
      200,
    );
  }

  async getSorts() {
    return successResponse(
      [
        { id: 1, value: 'NEWEST', label: 'Newest First' },
        { id: 2, value: 'OLDEST', label: 'Oldest First' },
      ],
      'Sort options fetched successfully',
      200,
    );
  }
}