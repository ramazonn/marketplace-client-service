import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams } from '../../../infrastructure';
import { Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/user/address')
export default class RemoveUserAddressController {
  @request('delete', '/remove/{addressId}')
  @summary('Remove address from user address list')
  @security([])
  @tags(['User Address'])
  @path({ addressId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let userId: IdParams;
    let addressId: IdParams;
    try {
      addressId = await new IdParams({ id: context.params.addressId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const result = await Repository.UserAddress().deleteById(new Types.ObjectId(addressId.id));
      return context.send.data({ deleted: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
