import { body, description, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams, ProductBasicDetailResponse, ProductListParams } from '../../infrastructure';
import { LanguageEnum, ProductsModel, CloudFlareService, Repository, ProductStatusEnum, SpecialEventStatusEnum, StoreStatusEnum, PreOrderShippingInfoSchema, ProductEntity, Redis } from '@ubaytools/core';
import { Types } from 'mongoose';
import { GetProductDetailUseCase } from '../../usecases';
import { searchNormalization } from '../../utils/searchNormalization';

export class ProductListItemResponse {
  id: string;
  name: string;
  description: string;
  oldPrice: number;
  currentPrice: number;
  discount_percent: number;
  discount_price: number;
  flags: Array<{ key: string; color: string }>;
  images: Array<string>;
  isFavorite: boolean;
  addedCompare: boolean;
  avgStars: number;
  countOfReview: number;
  countOfViews: number;
  characteristics: Array<{ key: string; value: string }>;
  store: any;
  model: { id: string; name: string };
  brand: { id: string; name: string };
  guaranty: string;
  count: number;
  categoryId: string;
  categoryName: string;
  short_description: string;
  advantages: string;
  stats: any
  cashbackPercent: number;
  isPreOrder: boolean;
  preOrderShippingInfo: PreOrderShippingInfoSchema;

  constructor(product: any, characteristics: any, lang: LanguageEnum) {
    const baseLang = this.getBaseLanguage(lang);

    this.id = product._id.toString();
    this.name = product.name?.[baseLang] ?? null;
    this.description = product.infos?.description?.[baseLang] ?? null;
    this.short_description = product.infos?.short_description?.[baseLang] ?? null;
    this.advantages = product.infos?.advantages?.[baseLang] ?? null;
    this.oldPrice = product.infos?.old_price ?? null;
    this.currentPrice = product.infos?.current_price ?? null;
    this.discount_percent = product.specialEvent && product.specialEvent.isActive ? product.specialEvent.discountPercent : product.infos?.discount_percent ?? 0;
    this.discount_price = product.specialEvent && product.specialEvent.isActive ? product.specialEvent.discountPrice : product.infos?.discount_price ?? 0;
    this.guaranty = product.infos?.guaranty ?? null;
    this.images = product.attachments?.length > 0 ? product.attachments.map((item: string) => CloudFlareService.getImageUrlByFileID(item)) : [];
    this.isFavorite = product.isFavorite || false;
    this.addedCompare = product.addedCompare || false;
    this.avgStars = product?.stats?.avgStars ?? null;
    this.countOfReview = product?.stats?.countOfReviews ?? null;
    this.countOfViews = product?.stats?.countOfViews ?? null;
    this.characteristics = characteristics ?? [];
    this.model = product.model ? { id: product.model._id.toString(), name: product.model.title[baseLang] } : null;
    this.brand = product.brand ? { id: product.brand._id.toString(), name: product.brand.title[baseLang] } : null;
    this.flags = this.processFlags(product.flagsInfo, baseLang);
    this.store = product.store
      ? {
          id: product.store._id.toString(),
          name: product.store.name,
          sku: product.store.shortname,
          description: product.store?.description?.[baseLang] ?? null,
          avatar: product.store.avatar ? CloudFlareService.getImageUrlByFileID(product.store.avatar) : null,
          avgStars: product.storeAvgStars ?? null,
          productCount: product.storeProductCount ?? 0,
        createdAt: product.store.createdAt,
        cashbackConfig:product.store?.cashbackConfig ?? null
          
        }
      : null;
    this.count = product.count || 0;
    this.categoryId = product.category?._id?.toString() ?? null;
    this.categoryName = product.category?.name?.[baseLang] ?? null;
    this.cashbackPercent = product?.cashbackPercent ?? null;
    this.isPreOrder = product?.isPreOrder ?? false;
    this.preOrderShippingInfo = product.preOrderShippingInfo ?? {};
  }
  private getBaseLanguage(lang: string): string {
    // Extract the base language code (e.g., 'en' from 'en-US')
    const baseLang = lang?.split('-')[0].toLowerCase();

    // Map the base language to the supported languages in your system
    const supportedLanguages = ['en', 'ru', 'uz'];
    return supportedLanguages.includes(baseLang) ? baseLang : 'en'; // Default to 'en' if not supported
  }

  private processFlags(flags: any[], lang: string): Array<{ key: string; color: string }> {
    if (!Array.isArray(flags)) return [];

    return flags.map((flag) => ({
      key: flag.name?.[lang] || flag.name?.['en'] || '',
      color: flag.color || '#000000', // Default to black if no color is specified
    }));
  }
}

@prefix('/product')
export default class GetProductListUniversalFilterController {
  @request('post', '/universal/filter')
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
      const sortStage = buildSortStage({ [params.sort]: 'asc' }); // TODO: Use sort key our own logic for sorting

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
      let productsCount: any = await redisClient.get(productCountCacheKey);
      if (productsCount) {
        productsCount = parseInt(productsCount);
      } else {
        // Extract match filter from matchStage for countDocumentsByFilter
        const matchFilter = matchStage.$match;
        productsCount = await Repository.Products().countDocumentsByFilter(matchFilter || {});

        await redisClient.set(productCountCacheKey, productsCount.toString(), 24 * 60 * 60);
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
        await redisClient.set(productListCacheKey, JSON.stringify(productIds), 24 * 60 * 60);
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
            pipeline.set(cacheKey, JSON.stringify(productData), { EX: 24 * 60 * 60 });
          }
        }
        await pipeline.exec();
      }

      // Build products array in order
      const products = productIds
        .map((productId) => productMap.get(productId))
        .filter((product) => product !== undefined);

      // Build response
      const productsResponse = products.map((product) => {
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

      //   for (const product of productsResponse) {
      //     product.isFavorite = likedProductMap.get(product.id) ?? false;
      //   }
      // }

      const storeMatchStage: any = {}
      let storeListCacheKey = `${process.env.NODE_ENV}:store:list`
      if (params?.search) {
        storeListCacheKey += `:search:${params.search}`;
        storeMatchStage.$or = [
          { 'name': { $regex: params.search, $options: 'i' } },
          { 'description.uz': { $regex: params.search, $options: 'i' } },
          { 'description.ru': { $regex: params.search, $options: 'i' } },
          { 'description.en': { $regex: params.search, $options: 'i' } },
        ];
      }

      let cachedStoreListData = await redisClient.get(storeListCacheKey);
      let storeList = [];
      if (cachedStoreListData) {
        try {
          storeList = JSON.parse(cachedStoreListData);
        } catch (error) {
          cachedStoreListData = null;
        }
      }

      if (!cachedStoreListData) {
        const stores = await Repository.Stores().list({ page: 1, size: 100 }, { ...storeMatchStage, status: { $ne: StoreStatusEnum.DELETED } }, { createdAt: 1 });
        storeList = stores.map((store) => {
          return {
            id: store.getId(),
            avatar:store.getAvatar(),
            name: store.getName(),
            description: store.getDescription().getByLang(context.lang)
          }
        })
        await redisClient.set(storeListCacheKey, JSON.stringify(storeList), 24 * 60 * 60);
      }

      return context.send.data({ totalProducts:productsCount, products: productsResponse || [], stores:storeList,totalStores:storeList.length });
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
      { 'normalizedSearchFields.categrory': { $regex: normalizedSearch, $options: 'i' } },
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
