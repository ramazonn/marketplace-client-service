import { body, path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { SetClientInfoParams } from '../../../infrastructure';
import { Repository, UserInfoEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/profile')
export default class UpdateUserInfoController {
  @request('put', '/info')
  @summary('Update user profile info')
  @security([])
  @tags(['Profile'])
  @body((SetClientInfoParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: SetClientInfoParams;
    try {
      params = await new SetClientInfoParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const user = context.client;
      let info = user.getUserInfo() ?? new UserInfoEntity();
      if (params.firstName) info.buildFirstname(params.firstName);
      if (params.lastName !== undefined) info.buildLastname(params.lastName);
      if (params.middleName !== undefined) info.buildMiddlename(params.middleName);
      if (params.email !== undefined) info.buildEmail(params.email);
      if (params.gender !== undefined) info.buildGender(params.gender);
      if (params.enableNotification !== undefined) info.buildEnableNotification(params.enableNotification);
      if (params.birthDate) {
        const [day, month, year] = params.birthDate.split('/');
        const birthDate = new Date(+year, +month - 1, +day);
        info.buildBirthdate(birthDate);
      } 
      
      user.buildUserInfo(info.convertToSchema());
      await Repository.Users().update(user);

      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
