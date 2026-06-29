import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CompareEntity, NotFoundError, Repository } from '@ubaytools/core';

import { Types } from 'mongoose';

@prefix('/compare')
export default class ClearCompareProductsController {
  @request('delete', '/clear')
  @summary('clear all products from compare')
  @security([])
  @tags(['Compare'])
  static async controller(context: Context): Promise<void> {
    try {
      const user = context.client;

      const compareList = await Repository.Compare().list({ page: 1, size: 100 }, { user: user.getId() });
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
