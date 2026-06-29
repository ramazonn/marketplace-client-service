import { body, path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { AddUserAddressParams, IdParams, ListParams } from '../../../infrastructure';
import { NotFoundError, Repository, UserAddressEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/address')
export default class AddUserAddressController {
  @request('post', '/add')
  @summary('User Address create')
  @security([])
  @tags(['User Address'])
  @body((AddUserAddressParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: AddUserAddressParams;
    try {
      params = await new AddUserAddressParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const address = new UserAddressEntity().buildUser(context.client.getId());
      address.buildAddress(params.address);
      address.buildLatitude(params.latitude)
      address.buildLongitude(params.longitude)

      const created = await Repository.UserAddress().create(address);
      return context.send.data({ created: true, id: created.getId().toString() });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
