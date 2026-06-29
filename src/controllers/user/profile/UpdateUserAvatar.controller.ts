import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { SetClientAvatarParams } from '../../../infrastructure';

import { CloudFlareService, Repository, UserInfoEntity } from '@ubaytools/core';

@prefix('/user/profile')
export default class UpdateUserAvatarController {
  @request('put', '/avatar')
  @summary('Update user avatar')
  @security([])
  @tags(['Profile'])
  @body((SetClientAvatarParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: SetClientAvatarParams;
    try {
      params = await new SetClientAvatarParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const user = context.client;
      let info = user.getUserInfo();
      if (!info) {
        info = new UserInfoEntity().buildAvatar(params.avatar);
      }
      info.buildAvatar(params.avatar);
      user.buildUserInfo(info.convertToSchema());
      await Repository.Users().update(user);
      return context.send.data({ updated: true, avatar: CloudFlareService.getImageUrlByFileID(params.avatar) });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
