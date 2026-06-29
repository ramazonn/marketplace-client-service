import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CloudFlareService, GenderEnum, UserEntity } from '@ubaytools/core';
import * as moment from 'moment';

export class UserProfileInfoResponse {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  birthDate: string;
  avatar: string;
  gender: GenderEnum;
  email: string;
  enableNotification: boolean;
  constructor(user: UserEntity) {
    this.id = user.getId().toString();
    this.firstName = user.getUserInfo()?.getFirstname() ?? null;
    this.lastName = user.getUserInfo()?.getLastname() ?? null;
    this.middleName = user.getUserInfo()?.getMiddlename() ?? null;
    this.birthDate = user.getUserInfo()?.getBirthdate() ? moment(user.getUserInfo()?.getBirthdate()).format('DD/MM/YYYY') : null;
    this.avatar = user.getUserInfo()?.getAvatar() ? CloudFlareService.getImageUrlByFileID(user.getUserInfo()?.getAvatar()) : null;
    this.gender = user.getUserInfo()?.getGender() ?? null;
    this.phoneNumber = user.getPhoneNumber() ?? null;
    this.email = user.getUserInfo()?.getEmail() ?? null;
    this.enableNotification = user.getUserInfo()?.getEnableNotification() ?? null;
  }
}

@prefix('/user/profile')
export default class GetUserProfileController {
  @request('get', '/detail')
  @summary('Get User profile details')
  @security([])
  @tags(['Profile'])
  static async controller(context: Context): Promise<void> {
    try {
      const response = new UserProfileInfoResponse(context.client);
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
