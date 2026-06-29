import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CompareEntity, NotFoundError, Repository } from '@ubaytools/core';

import { Types } from 'mongoose';

@prefix('/compare')
export default class RemoveProductFromCompareController {
  @request('delete', '/remove-product')
  @summary('Remove product from compare')
  @security([])
  @tags(['Compare'])
  @body({ productId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    try {
      const { productId } = context.request.body as any;
      const user = context.client;

      const compareList = await Repository.Compare().list({ page: 1, size: 10 }, { user: user.getId(), product: new Types.ObjectId(productId) });
      await Promise.all(
        compareList.map(async (item) => {
          await Repository.Compare().deleteById(item.getId());
        }),
      );

      return context.send.data({ deleted: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
