import { body, path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { AddUserAddressParams, IdParams, ListParams } from '../../../infrastructure';
import { NotFoundError, Repository, UserAddressEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/address')
export default class UpdateUserAddressController {
  @request('put', '/{addressId}')
  @summary('User Address update')
  @security([])
  @tags(['User Address'])
  @body((AddUserAddressParams as any).swaggerDocument)
  @path({ addressId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: AddUserAddressParams;
    let idParams: IdParams;
    try {
      params = await new AddUserAddressParams(context.request.body).validate();
      idParams = await new IdParams({ id: context.params.addressId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const address = await Repository.UserAddress().getById(new Types.ObjectId(idParams.id));
      if (!address) {
        throw new NotFoundError('User address');
      }
      if (params.address) address.buildAddress(params.address);
      if (params.latitude) address.buildLatitude(params.latitude);
      if (params.longitude) address.buildLongitude(params.longitude);
      await Repository.UserAddress().update(address);
      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
