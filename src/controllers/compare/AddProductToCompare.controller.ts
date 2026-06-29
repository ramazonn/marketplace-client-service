import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CompareEntity, NotFoundError, Repository } from '@ubaytools/core';

import { Types } from 'mongoose';

@prefix('/compare')
export default class AddProductToCompareController {
  @request('post', '/add')
  @summary('Add a product to compare')
  @security([])
  @tags(['Compare'])
  @body({ productId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    const { productId } = context.request.body as any;
    try {
      const user = context.client;
      const product = await Repository.Products().getById(new Types.ObjectId(productId));
      if (!product) {
        throw new NotFoundError('Product');
      }
      const found = await Repository.Compare().list({ page: 1, size: 1 }, { user: user.getId(), product: product.getId() });
      if(found.length===0){
        const compareToCreate = new CompareEntity()
          .buildUser(user.getId())
          .buildProduct(product.getId())
          .buildCategory(product.getCategory() as Types.ObjectId);
        await Repository.Compare().create(compareToCreate);
      }
      return context.send.data({ added: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
