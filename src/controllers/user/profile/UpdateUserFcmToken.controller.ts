import { body, path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { SetClientInfoParams } from '../../../infrastructure';
import { NotFoundError, Repository, UserInfoEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/profile')
export default class UpdateUserFcmTokenController {
  @request('put', '/fcm-token')
  @summary('Update user profile fcm-token')
  @security([])
  @tags(['Profile'])
  @body({ fcmToken: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    const { fcmToken } = context.request.body as any;
    try {
      const user = context.client;

      if (fcmToken) {
        try {
          const device = await Repository.Device().getByOwner(user.getId());
          if (!device) {
            throw new NotFoundError('User device');
          }
          device.buildFcmToken(fcmToken);
          await Repository.Device().update(device);
        } catch (error) {
          console.error('Failed to update FCM token', error);
        }
      }
      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
