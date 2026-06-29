import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams, ProductBasicDetailResponse } from '../../infrastructure';
import { ProductEntity, ProductStatusEnum, ProductsModel, Redis, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';
import { GetProductDetailUseCase } from '../../usecases';
import { product } from 'ramda';

type RedisClient = Awaited<ReturnType<typeof Redis.getInstance>>;

@prefix('/product')
export default class GetHomeFeedController {
  private static readonly BUCKET_COUNT = 50;
  private static readonly BUCKET_ROTATION_HOURS = 6;
  private static readonly HOME_FEED_CACHE_TTL_SEC = 60 * 60; // 1 hour (page + count)
  private static readonly PERSONALIZED_FEED_CACHE_TTL_SEC = 60 * 10; // 10 minutes
  private static readonly NEWEST_DAYS = 30; // "last month" for 30% newest
  private static readonly NEWEST_RATIO = 0.3; // 30% newest, 70% other

  private static newestSince(): Date {
    const date = new Date();
    date.setDate(date.getDate() - GetHomeFeedController.NEWEST_DAYS);
    return date;
  }

  /**
   * Paginated newest product IDs (last NEWEST_DAYS). Cached per page + size.
   */
  private static async getNewestProductIds(params: { bucket: number; page: number; size: number; redisClient: RedisClient }): Promise<string[]> {
    const { bucket, page, size, redisClient } = params;
    if (size <= 0) return [];

    const cacheKey = `${process.env.NODE_ENV}:home:feed:newest:products:bucket:${bucket}:page:${page}:size:${size}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // invalid JSON, fall through to aggregate
      }
    }

    const since = GetHomeFeedController.newestSince();
    const bucketCount = GetHomeFeedController.BUCKET_COUNT;
    const aggregatePipeline: any[] = [
      {
        $match: {
          status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] },
          createdAt: { $gte: since },
        },
      },
      {
        // Circular distance: min(|a-b|, BUCKET_COUNT - |a-b|) so bucket 49 is distance 1 from bucket 0
        $addFields: {
          bucketDistance: {
            $let: {
              vars: {
                linearDiff: {
                  $abs: {
                    $subtract: [{ $ifNull: ['$randomBucket', 0] }, bucket],
                  },
                },
              },
              in: {
                $min: ['$$linearDiff', { $subtract: [bucketCount, '$$linearDiff'] }],
              },
            },
          },
        },
      },
      { $sort: { bucketDistance: 1, createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * size },
      { $limit: size },
      { $project: { _id: 1 } },
    ];

    const result = await ProductsModel.aggregate(aggregatePipeline);
    const ids = result.map((item: { _id: Types.ObjectId }) => item._id.toString());
    await redisClient.set(cacheKey, JSON.stringify(ids), GetHomeFeedController.HOME_FEED_CACHE_TTL_SEC);
    return ids;
  }

  /**
   * Paginated "random" product IDs (not in last month). Cached per page + size.
   */
  private static async getRandomProductIds(params: { bucket: number; page: number; size: number; redisClient: RedisClient }): Promise<string[]> {
    const { bucket, page, size, redisClient } = params;
    if (size <= 0) return [];

    const cacheKey = `${process.env.NODE_ENV}:home:feed:random:products:bucket:${bucket}:page:${page}:size:${size}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // invalid JSON, fall through
      }
    }

    const since = GetHomeFeedController.newestSince();
    const bucketCount = GetHomeFeedController.BUCKET_COUNT;
    const aggregatePipeline: any[] = [
      {
        $match: {
          status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] },
          createdAt: { $lt: since },
        },
      },
      {
        // Circular distance: min(|a-b|, BUCKET_COUNT - |a-b|) so bucket 49 is distance 1 from bucket 0
        $addFields: {
          bucketDistance: {
            $let: {
              vars: {
                linearDiff: {
                  $abs: {
                    $subtract: [{ $ifNull: ['$randomBucket', 0] }, bucket],
                  },
                },
              },
              in: {
                $min: ['$$linearDiff', { $subtract: [bucketCount, '$$linearDiff'] }],
              },
            },
          },
        },
      },
      { $sort: { bucketDistance: 1, createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * size },
      { $limit: size },
      { $project: { _id: 1 } },
    ];

    const result = await ProductsModel.aggregate(aggregatePipeline);
    const ids = result.map((item: { _id: Types.ObjectId }) => item._id.toString());
    await redisClient.set(cacheKey, JSON.stringify(ids), GetHomeFeedController.HOME_FEED_CACHE_TTL_SEC);
    return ids;
  }

  private static async getPersonalizedProductIds(params: {
    userId: string;
    size: number;
    page: number;
    redisClient: RedisClient;
  }): Promise<string[]> {
    const { userId, size, page, redisClient } = params;

    const client = redisClient.getClient();

    const categoryKey = `${process.env.NODE_ENV}:user:interest:categories:${userId}`;
    const brandKey = `${process.env.NODE_ENV}:user:interest:brands:${userId}`;
    const productKey = `${process.env.NODE_ENV}:user:interest:products:${userId}`;

    // Retrieve the item with the highest interest score from the sorted set.
    // 0,0 → return only the first element; REV=true ensures the highest score comes first.
    const topCategory = await (client as any).zRange(categoryKey, 0, 0, { REV: true, WITHSCORES: true });
    const topBrand = await (client as any).zRange(brandKey, 0, 0, { REV: true, WITHSCORES: true });
    const topProduct = await (client as any).zRange(productKey, 0, 0, { REV: true, WITHSCORES: true });

    //------------------------------------
    // 1️⃣ CATEGORY PRIORITY
    //------------------------------------

    if (topCategory.length) {
      const products = await ProductsModel.find({
        category: new Types.ObjectId(topCategory[0]),
        status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] },
      })
        .sort({ _id: -1 })
        .skip((page - 1) * size)
        .limit(size)
        .select('_id')
        .lean();
      return products.map((p) => p._id.toString());
    }

    //------------------------------------
    // 2️⃣ PRODUCT CATEGORY
    //------------------------------------
    if (topProduct.length) {
      const product = await ProductsModel.findById(topProduct[0]).select('category').lean();

      if (product?.category) {
        const products = await ProductsModel.find({
          category: product.category,
          status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] },
        })
          .sort({ _id: -1 })
          .skip((page - 1) * size)
          .limit(size)
          .select('_id')
          .lean();

        return products.map((p) => p._id.toString());
      }
    }
    //------------------------------------
    // 3️⃣ BRAND
    //------------------------------------

    if (topBrand.length) {
      const products = await ProductsModel.find({
        'infos.brand': new Types.ObjectId(topBrand[0]),
        status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] },
      })
        .sort({ _id: -1 })
        .skip((page - 1) * size)
        .limit(size)
        .select('_id')
        .lean();

      return products.map((p) => p._id.toString());
    }

    return [];
  }

  /**
   * Layer 1: Get paginated product IDs — 30% from newest (last NEWEST_DAYS), 70% from random. Combined result cached per page.
   */

  private static async getHomeFeedProductIds(params: {
    page: number;
    size: number;
    bucket: number;
    redisClient: RedisClient;
    userId?: string | null;
  }): Promise<string[]> {
    const { page, size, bucket, redisClient, userId } = params;

    const pageCacheKey = `${process.env.NODE_ENV}:home:feed:products:user:${userId}:bucket:${bucket}:page:${page}:size:${size}`;

    const pageCached = await redisClient.get(pageCacheKey);
    if (pageCached) {
      try {
        return JSON.parse(pageCached);
      } catch {}
    }

    let productIds: string[] = [];
    const globalSkip = (page - 1) * size;
    let personalized: string[] = [];

    if (userId) {
      personalized = await GetHomeFeedController.getPersonalizedProductIds({
        userId,
        size,
        page,
        redisClient,
      });

      productIds.push(...personalized);
    }

    const remaining = size - productIds.length;

    if (remaining > 0) {
      const personalizedOffset = personalized.length;

      const fallbackSkip = Math.max(0, globalSkip - personalizedOffset);

      const fallbackPage = Math.floor(fallbackSkip / size) + 1;

      const newestSize = Math.round(remaining * GetHomeFeedController.NEWEST_RATIO);

      const newest = await GetHomeFeedController.getNewestProductIds({
        bucket,
        page: fallbackPage,
        size: newestSize,
        redisClient,
      });

      productIds.push(...newest);
      const remaining2 = size - productIds.length;

      if (remaining2 > 0) {
        const random = await GetHomeFeedController.getRandomProductIds({
          bucket,
          page: fallbackPage,
          size: remaining2,
          redisClient,
        });

        productIds.push(...random);
      }
    }

    productIds = [...new Set(productIds)].slice(0, size);

    await redisClient.set(pageCacheKey, JSON.stringify(productIds), GetHomeFeedController.HOME_FEED_CACHE_TTL_SEC);

    return productIds;
  }

  @request('get', '/home/feed')
  @summary('Home feed (infinite scroll)')
  @security([])
  @tags(['Product'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let listParams: ListParams;
    try {
      listParams = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const lang = context.lang;
      const bucket = Math.floor(Date.now() / (1000 * 60 * 60 * GetHomeFeedController.BUCKET_ROTATION_HOURS)) % GetHomeFeedController.BUCKET_COUNT;

      const redisClient = await Redis.getInstance();
      let userId: string | null = null;
      if (context.client) {
        userId = context.client.getId();
      }

      // Total count (cached per bucket, 1 hour)
      const countCacheKey = `${process.env.NODE_ENV}:home:feed:products:count:bucket:${bucket}`;
      let total: number;
      const cachedCount = await redisClient.get(countCacheKey);
      const parsed = cachedCount != null ? parseInt(cachedCount, 10) : NaN;
      if (cachedCount != null && !isNaN(parsed)) {
        total = parsed;
      } else {
        total = await Repository.Products().countDocumentsByFilter({
          status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] },
        });
        await redisClient.set(countCacheKey, total.toString(), GetHomeFeedController.HOME_FEED_CACHE_TTL_SEC);
      }

      // Layer 1: get paginated product IDs
      const productIds = await GetHomeFeedController.getHomeFeedProductIds({
        page: listParams.page,
        size: listParams.size,
        bucket,
        redisClient,
        userId,
      });
      if (productIds.length === 0) {
        return context.send.data({ total, items: [] });
      }

      // Layer 2: hydrate product details (mget -> missing basicDetail -> pipeline set -> response)
      const productCacheKeys = productIds.map((id) => `${process.env.NODE_ENV}:product:basic:${id}:${lang}`);
      const cachedProductsData = productCacheKeys.length > 0 ? await redisClient.mget(productCacheKeys) : [];

      const productMap = new Map<string, any>();
      const missingProductIds: Types.ObjectId[] = [];

      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        const cachedData = cachedProductsData[i];
        if (cachedData) {
          try {
            const productData = JSON.parse(cachedData);
            productMap.set(productId, productData);
          } catch {
            missingProductIds.push(new Types.ObjectId(productId));
          }
        } else {
          missingProductIds.push(new Types.ObjectId(productId));
        }
      }

      if (missingProductIds.length > 0) {
        const batchProductData = await GetProductDetailUseCase.basicDetail(missingProductIds, lang);
        const pipeline = await redisClient.pipeline();
        for (const productId of missingProductIds) {
          const productData = batchProductData.find((p) => p._id.toString() === productId.toString());
          if (productData) {
            productMap.set(productId.toString(), productData);
            const cacheKey = `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`;
            pipeline.set(cacheKey, JSON.stringify(productData), { EX: 24 * 60 * 60 });
          }
        }
        await pipeline.exec();
      }

      const products = productIds.map((id) => productMap.get(id)).filter((p) => p !== undefined);

      const items = products.map((p) => new ProductBasicDetailResponse(p, context.lang));

      /**
       * VAQTINCHA O‘CHIRILDI:
       * Cache testlari uchun isFavorite / isLiked tekshiruvlari o‘chirildi
       */

      // if (userId && productIds.length > 0) {
      //   const objectIds = productIds.map((id) => new Types.ObjectId(id));
      //   const likedProducts = await Repository.UserLikedProducts().list(
      //     { page: 1, size: productIds.length },
      //     { user: userId, isLiked: true, product: { $in: objectIds } }
      //   );
      //   const likedProductMap = new Map<string, boolean>();
      //   for (const likedProduct of likedProducts) {
      //     const pid = (likedProduct.getProduct() as ProductEntity)?.getId()?.toString();
      //     if (pid) likedProductMap.set(pid, true);
      //   }
      //   for (const product of items) {
      //     product.isFavorite = likedProductMap.get(product.id) ?? false;
      //   }
      // }

      return context.send.data({ total, items: items || [] });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
