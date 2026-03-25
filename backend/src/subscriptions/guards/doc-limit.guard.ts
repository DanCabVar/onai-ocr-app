import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions.service';

/**
 * Guard that checks if the user has remaining document quota.
 * Apply to endpoints that process/upload documents.
 */
@Injectable()
export class DocLimitGuard implements CanActivate {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    await this.subscriptionsService.checkDocumentLimit(user.id);
    return true;
  }
}
