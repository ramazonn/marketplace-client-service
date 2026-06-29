import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { SetClientAvatarParams } from '../../../infrastructure';

import { CloudFlareService, NotFoundError, Repository, UserInfoEntity, UserStatusEnum } from '@ubaytools/core';

@prefix('/user/profile')
export default class DeleteAccountController {
  @request('delete', '/')
  @summary('Delete Account')
  @security([])
  @tags(['Profile'])
  static async controller(context: Context): Promise<void> {
    try {
      const user = context.client;
      if (!user) {
        throw new NotFoundError('User');
      }
      user.buildStatus(UserStatusEnum.DELETED);
      await Repository.Users().update(user);
      return context.send.data({ deleted: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
