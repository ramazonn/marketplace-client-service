import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CompareModel, NotFoundError } from '@ubaytools/core';

import { getBaseLanguage } from '../../utils';

@prefix('/compare')
export default class GetCompareFiltersController {
  @request('get', '/filters')
  @summary('get compare filters')
  @security([])
  @tags(['Compare'])
  static async controller(context: Context): Promise<void> {
    try {
      const user = context.client;

      if (!user) {
        throw new NotFoundError('User');
      }

      const aggregationPipeline = [
        {
          $match: { user: user.getId() },
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo',
          },
        },
        {
          $unwind: '$categoryInfo',
        },
        {
          $group: {
            _id: '$categoryInfo._id',
            name: { $first: `$categoryInfo.name.${getBaseLanguage(context.lang)}` },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            name: 1,
            count: 1,
          },
        },
      ];

      const categories = await CompareModel.aggregate(aggregationPipeline);

      return context.send.data({ categories });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
