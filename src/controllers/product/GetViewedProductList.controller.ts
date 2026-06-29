import { body, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams, ProductBasicDetailResponse, ProductListParams } from '../../infrastructure';
import {
  LanguageEnum,
  ProductsModel,
  CloudFlareService,
  Repository,
  ProductStatusEnum,
  SpecialEventStatusEnum,
  UserViewedProductsEntity,
  ProductEntity,
  Redis,
} from '@ubaytools/core';
import { Types } from 'mongoose';
import { GetProductDetailUseCase } from '../../usecases';

@prefix('/product')
export default class GetViewedProductListController {
  @request('get', '/viewed')
  @summary('Product list')
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
      const userId = context.client.getId();

      // const result = await Repository.UserViewedProducts().list({page:listParams.page,size:listParams.size},{user:userId},{updatedAt:-1})

      // const products = await Promise.all(
      //   result.map(async (item: UserViewedProductsEntity) => {
      //     return await GetProductDetailUseCase.execute((item.getProduct()as ProductEntity)?.getId().toString(), context.lang, userId);
      //   }),
      // );

      // return context.send.data({ items: products || [] });
      // return context.send.data({ items: [] });

      const redis = await Redis.getInstance();
      const lang = context.lang;

      const key = `${process.env.NODE_ENV}:user:${userId}:viewedProducts`;

      const raw = await redis.get(key);

      if (!raw) {
        return context.send.data({ items: [] });
      }

      let productIds: string[] = [];

      try {
        productIds = JSON.parse(raw);
      } catch {
        productIds = [];
      }
      const start = (listParams.page - 1) * listParams.size;
      const end = start + listParams.size;

      const paginatedIds = productIds.slice(start, end);

      const productCacheKeys = paginatedIds.map((id) => `${process.env.NODE_ENV}:product:basic:${id}:${lang}`);

      const cachedProducts = productCacheKeys.length > 0 ? await redis.mget(productCacheKeys) : [];

      const productMap = new Map<string, any>();
      const missingIds: Types.ObjectId[] = [];

      for (let i = 0; i < paginatedIds.length; i++) {
        const id = paginatedIds[i];
        const cached = cachedProducts[i];

        if (cached) {
          try {
            productMap.set(id, JSON.parse(cached));
          } catch {
            missingIds.push(new Types.ObjectId(id));
          }
        } else {
          missingIds.push(new Types.ObjectId(id));
        }
      }

      if (missingIds.length > 0) {
        const products = await GetProductDetailUseCase.basicDetail(missingIds, lang);

        for (const p of products) {
          const id = p._id.toString();
          productMap.set(id, p);
        }
      }

      const items = paginatedIds
        .map((id) => productMap.get(id))
        .filter(Boolean)
        .map((p) => new ProductBasicDetailResponse(p, context.lang));

      return context.send.data({
        items,
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
