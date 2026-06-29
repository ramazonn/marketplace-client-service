import { Context } from 'koa';
import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { ProductsModel } from '@ubaytools/core';

const HOME_FEED_INDEX_SPEC = { status: 1, randomBucket: 1, createdAt: -1 };
const RANDOM_BUCKET_FILTER = {
  $or: [
    { randomBucket: { $exists: false } },
    { randomBucket: null },
    { randomBucket: 0 },
  ],
};

/**
 * One-time API: create home feed index and backfill randomBucket (0..49) for products where missing or 0.
 */
@prefix('/product')
export default class HomeFeedSetupController {
  @request('post', '/home-feed-setup')
  @summary('One-time: create home feed index + backfill randomBucket')
  @security([])
  @tags(['Product'])
  static async controller(context: Context): Promise<void> {
    try {
      const collection = ProductsModel.collection;

      // 1. Create index { status: 1, randomBucket: 1, createdAt: -1 }
      const indexName = await collection.createIndex(HOME_FEED_INDEX_SPEC);

      // 2. Backfill: set randomBucket to random 0..49 where missing or 0 (Mongo 4.4+ pipeline)
      const updateResult = await ProductsModel.updateMany(RANDOM_BUCKET_FILTER, [
        {
          $set: {
            randomBucket: { $floor: { $multiply: [{ $rand: {} }, 50] } },
          },
        },
      ]);

      return context.send.data({
        index: { name: indexName, spec: HOME_FEED_INDEX_SPEC },
        backfill: {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        },
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
