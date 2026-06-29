import { body, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams, ProductBasicDetailResponse, ProductListParams } from '../../infrastructure';
import { ProductsModel, Repository, ProductStatusEnum, Redis, ProductEntity } from '@ubaytools/core';
import { Types } from 'mongoose';
import { GetProductDetailUseCase } from '../../usecases';
import { searchNormalization } from '../../utils/searchNormalization';
import { CacheTTLUtil } from '../../utils';


@prefix('/product')
export default class GetProductListController {
  @request('post', '/list')
  @summary('Product list')
  @security([])
  @tags(['Product'])
  @query((ListParams as any).swaggerDocument)
  @body((ProductListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let listParams: ListParams;
    let params: ProductListParams;
    try {
      listParams = await new ListParams(context.request.query).validate();
      params = await new ProductListParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const lang = context.lang;

      const matchStage = await buildMatchStage(params.filter, params.search);

      const redisClient = await Redis.getInstance();
      let userId = null;
      if (context.client) {
        userId = context.client.getId();
      }

      let productCountCacheKey = `${process.env.NODE_ENV}:product:list:count`      
      let productListCacheKey = `${process.env.NODE_ENV}:product:list`

      if (params?.search) {
        productCountCacheKey += `:search:${params?.search}`;
        productListCacheKey += `:search:${params?.search}`;
      }

      if (params?.filter?.category) { 
        productCountCacheKey += `:category:${params?.filter?.category}`;
        productListCacheKey += `:category:${params?.filter?.category}`;
      }

      if (params?.filter?.store) { 
        productCountCacheKey += `:store:${params?.filter?.store}`;
        productListCacheKey += `:store:${params?.filter?.store}`;
      }    

      if (params?.filter?.brands?.length > 0) { 
        productCountCacheKey += `:brands`;
        productListCacheKey += `:brands`;
        for (let brand of params.filter.brands) {
          productCountCacheKey += `:${brand}`;
          productListCacheKey += `:${brand}`;
        }
      }

      productListCacheKey += `:${listParams.page}:${listParams.size}:${lang}`;
      
      // Get count
      let count: any = await redisClient.get(productCountCacheKey);
      if (count) {
        count = parseInt(count);
      } else {
        // Extract match filter from matchStage for countDocumentsByFilter
        const matchFilter = matchStage.$match;
        count = await Repository.Products().countDocumentsByFilter(matchFilter || {});

        const cacheCountTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(productCountCacheKey, count.toString(), cacheCountTTL);
      }
      
      // Get paginated product IDs from cache
      let cachedProductIds: any = await redisClient.get(productListCacheKey);
      let productIds: string[] = [];

      if (cachedProductIds) {
        try {
          productIds = JSON.parse(cachedProductIds);
        } catch (error) {
          cachedProductIds = null;
        }
      }

      // If product IDs not cached, get paginated IDs from DB
      if (!cachedProductIds) {
        const aggregatePipeline = [
          matchStage,
          // Dont forget to implement sort stage
          // sortStage,
          {
            $skip: (listParams.page - 1) * listParams.size,
          },
          {
            $limit: listParams.size,
          },
          {
            $project: {
              _id: 1,
            },
          },
        ];
        const result = await ProductsModel.aggregate(aggregatePipeline);
        productIds = result.map((item) => item._id.toString());
        // Cache paginated product IDs
        const cacheproductIdsTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 60);
        await redisClient.set(productListCacheKey, JSON.stringify(productIds), cacheproductIdsTTL);
      }

      // Batch get all product caches at once (single Redis call)
      const productCacheKeys = productIds.map((productId) => `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`);
      const cachedProductsData = productCacheKeys.length > 0 ? await redisClient.mget(productCacheKeys) : [];
      // Process cached products
      const productMap = new Map<string, any>();
      const missingProductIds: Types.ObjectId[] = [];

      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        const cachedData = cachedProductsData[i];

        if (cachedData) {
          try {
            const productData = JSON.parse(cachedData);
            productMap.set(productId, productData);
          } catch (error) {
            missingProductIds.push(new Types.ObjectId(productId));
          }
        } else {
          missingProductIds.push(new Types.ObjectId(productId));
        }
      }

      // If some products are missing, fetch them in batch
      if (missingProductIds.length > 0) {
        const batchProductData = await GetProductDetailUseCase.basicDetail(missingProductIds, lang);

        // Cache and add to productMap using pipeline (single Redis call)
        const pipeline = await redisClient.pipeline();
        for (const productId of missingProductIds) {
          const productData = batchProductData.find((product) => product._id.toString() === productId.toString());
          if (productData) {
            productMap.set(productId.toString(), productData);

            // Add to pipeline
            const cacheKey = `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`;
            const cacheproductTTL =  CacheTTLUtil.withRandomTTL(24 * 60 * 60);
            pipeline.set(cacheKey, JSON.stringify(productData), { EX: cacheproductTTL });
          }
        }
        await pipeline.exec();
      }

      // Build products array in order
      const products = productIds
        .map((productId) => productMap.get(productId))
        .filter((product) => product !== undefined);

      // Build response
      const response = products.map((product) => {
        return new ProductBasicDetailResponse(product, context.lang);
      });

      /**
      * VAQTINCHA O‘CHIRILDI:
      * Cache testlari uchun isFavorite / isLiked tekshiruvlari o‘chirildi
      */
     
      // Handle user-specific fields
      // if (userId && productIds.length > 0) {
      //   const objectIds = productIds.map((id) => new Types.ObjectId(id));

      //   const likedProducts = await Repository.UserLikedProducts().list(
      //     { page: 1, size: productIds.length },
      //     { user: userId, isLiked: true, product: { $in: objectIds } },
      //   );

      //   const likedProductMap = new Map<string, boolean>();
      //   for (const likedProduct of likedProducts) {
      //     const pid = (likedProduct.getProduct() as ProductEntity)?.getId()?.toString();
      //     if (pid) likedProductMap.set(pid, true);
      //   }

      //   for (const product of response) {
      //     product.isFavorite = likedProductMap.get(product.id) ?? false;
      //   }
      // }

      return context.send.data({ total: count, items: response || [] });
    } catch (error) {
      return context.send.error(error);
    }
  }
}

async function buildMatchStage(filter: any, search: any) {
  const match: any = { status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] } };
  if (filter) {
    if (filter.category) {
      const categoryIds = await getAllSubcategories(filter.category);
      match.category = { $in: categoryIds.map((id) => new Types.ObjectId(id)) };
    }
    if (filter.brands && Array.isArray(filter.brands) && filter.brands.length > 0) {
      match['infos.brand'] = { $in: filter.brands.map((id: string) => new Types.ObjectId(id)) };
    }

    if (filter.models && Array.isArray(filter.models) && filter.models.length > 0) {
      match['infos.model'] = { $in: filter.models.map((id: string) => new Types.ObjectId(id)) };
    }
    if (filter?.price?.from !== undefined || filter?.price?.to !== undefined) {
      match['infos.current_price'] = {};
      if (filter.price.from !== undefined) match['infos.current_price'].$gte = filter.price.from;
      if (filter.price.to !== undefined) match['infos.current_price'].$lte = filter.price.to;
    }
    if (filter.store) match.store = new Types.ObjectId(filter.store);
  }

  if (search) {
    const normalizedSearch = searchNormalization(search);
    match.$or = [
      { 'normalizedSearchFields.name': { $regex: normalizedSearch, $options: 'i' } },
      { 'normalizedSearchFields.description': { $regex: normalizedSearch, $options: 'i' } },
      { 'normalizedSearchFields.category': { $regex: normalizedSearch, $options: 'i' } },
      { 'normalizedSearchFields.tags': { $regex: normalizedSearch, $options: 'i' } },
      { 'normalizedSearchFields.brand': { $regex: normalizedSearch, $options: 'i' } },
    ];
  }

  return { $match: match };
}

function buildSortStage(sort?: { [key: string]: 'asc' | 'desc' }): any {
  if (!sort) return { $sort: { _id: 1 } }; // Default sort

  const sortStage: { [key: string]: 1 | -1 } = {};
  Object.entries(sort).forEach(([key, value]) => {
    sortStage[key] = value === 'asc' ? 1 : -1;
  });

  return { $sort: sortStage };
}

async function getAllSubcategories(categoryId: string): Promise<string[]> {
  const allCategories = await Repository.Categories().list({ page: 1, size: 1000 }, {});

  function getSubcategoriesRecursive(parentId: string): string[] {
    const directSubcategories = allCategories.filter((cat) => cat.getParent()?.toString() === parentId);
    let allSubcategories = directSubcategories.map((cat) => cat.getId().toString());

    for (const subcat of directSubcategories) {
      allSubcategories = allSubcategories.concat(getSubcategoriesRecursive(subcat.getId().toString()));
    }

    return allSubcategories;
  }

  return [categoryId, ...getSubcategoriesRecursive(categoryId)];
}
