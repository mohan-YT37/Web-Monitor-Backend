import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SharedResource } from '../entities/shared-resource.entity';

@Injectable()
export class ShareAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(SharedResource)
    private sharedResourceRepo: Repository<SharedResource>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const shareToken = request.params.token || request.query.token;

    if (!shareToken) {
      return false;
    }

    const sharedResource = await this.sharedResourceRepo.findOne({
      where: { share_token: shareToken, is_otp_verified: true },
    });

    if (!sharedResource) {
      return false;
    }

    // Attach share info to request
    request.sharedResource = sharedResource;
    return true;
  }
}
