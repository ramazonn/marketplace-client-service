import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { AddUserAddressParams, IdParams, ListParams } from '../../../infrastructure';
import { Repository, UserAddressEntity } from '@ubaytools/core';

export class UserAddressItemResponse {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  constructor(userAddress: UserAddressEntity) {
    this.id = userAddress.getId().toString();
    this.address = userAddress.getAddress();
    this.latitude = userAddress.getLatitude();
    this.longitude = userAddress.getLongitude();
  }
}

@prefix('/user/address')
export default class GetUserAddressListController {
  @request('get', '/list')
  @summary('User Address list')
  @security([])
  @tags(['User Address'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;
    try {
      params = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const count = await Repository.UserAddress().countDocumentsByFilter({ user: context.client.getId() });
      const addresses = await Repository.UserAddress().list({ page: params.page, size: params.size }, { user: context.client.getId() });
      const response = addresses.map((item) => new UserAddressItemResponse(item));
      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
