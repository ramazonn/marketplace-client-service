import { LanguageEnum, ProductEntity, Redis, Repository } from "@ubaytools/core";
import { header, prefix, query, request, security, summary, tags } from "koa-swagger-decorator";
import { Context } from "koa";
import { Types } from "mongoose";
import { ListParams, ProductBasicDetailResponse } from "../../../infrastructure";
import { GetProductDetailUseCase } from "../../../usecases";

function isProductEntity(p: any): p is ProductEntity {
    return p && typeof p.getId === 'function';
}

const FAVORITE_CACHE_TTL_SEC = 24 * 60 * 60;

@prefix('/user/favorite')
export default class GetMyFavoriteProductsController {

    @request('get', '/list')
    @summary('Get my favorite products')
    @security([])
    @tags(['Favorite'])
    @header({
        'content-language': {
            type: 'string',
            example: LanguageEnum.RU,
            description: 'values: ' + Object.values(LanguageEnum).join(' | ')
        }
    })
    @query((ListParams as any).swaggerDocument)

    static async controller(context: Context): Promise<void> {
        let listParams: ListParams;

        try {
            listParams = await new ListParams(context.request.query).validate();
        } catch (error) {
            return context.send.error(await context.joi.handle(error));
        }

        try {
            const userId = context.client?.getId();
            const lang = context.lang;

            if (!userId) {
                return context.send.data({ total: 0, items: [] });
            }

            const redisClient = await Redis.getInstance();
            const countCacheKey = `${process.env.NODE_ENV}:user:favorite:count:${userId}`;
            const listCacheKey = `${process.env.NODE_ENV}:user:favorite:list:${userId}:${listParams.page}:${listParams.size}`;

            // Get count from cache or DB
            let count: number | null = null;
            const cachedCount = await redisClient.get(countCacheKey);
            if (cachedCount !== null && cachedCount !== undefined) {
                count = parseInt(cachedCount, 10);
            }
            if (count === null || isNaN(count)) {
                count = await Repository.UserLikedProducts().countDocumentsByFilter({
                    user: userId,
                    isLiked: true,
                });
                await redisClient.set(countCacheKey, count.toString(), FAVORITE_CACHE_TTL_SEC);
            }

            // Get paginated product IDs from cache or DB
            let productIds: string[] = [];
            let cachedProductIds: string | null = await redisClient.get(listCacheKey);
            if (cachedProductIds) {
                try {
                    productIds = JSON.parse(cachedProductIds);
                } catch {
                    cachedProductIds = null;
                }
            }
            if (!cachedProductIds) {
                const favorites = await Repository.UserLikedProducts().list(
                    { page: listParams.page, size: listParams.size },
                    { user: userId, isLiked: true },
                    { updatedAt: -1 }
                );
                productIds = favorites
                    .map((f) => f.getProduct())
                    .filter(isProductEntity)
                    .map((p) => p.getId().toString());
                await redisClient.set(listCacheKey, JSON.stringify(productIds), FAVORITE_CACHE_TTL_SEC);
            }

            if (productIds.length === 0) {
                return context.send.data({ total: count, items: [] });
            }

            // Batch get product basic details from Redis
            const productCacheKeys = productIds.map(
                (id) => `${process.env.NODE_ENV}:product:basic:${id}:${lang}`
            );
            const cachedProductsData = await redisClient.mget(productCacheKeys);
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

            // Fetch missing products and cache them
            if (missingProductIds.length > 0) {
                const batchProductData = await GetProductDetailUseCase.basicDetail(missingProductIds, lang);
                const pipeline = await redisClient.pipeline();
                for (const productId of missingProductIds) {
                    const productData = batchProductData.find(
                        (p) => p._id.toString() === productId.toString()
                    );
                    if (productData) {
                        productMap.set(productId.toString(), productData);
                        const key = `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`;
                        pipeline.set(key, JSON.stringify(productData), { EX: FAVORITE_CACHE_TTL_SEC });
                    }
                }
                await pipeline.exec();
            }

            const products = productIds
                .map((id) => productMap.get(id))
                .filter((p) => p !== undefined);
            const response = products.map((product) => {
                const res = new ProductBasicDetailResponse(product, lang);
                res.isFavorite = true;
                return res;
            });

            return context.send.data({ total: count, items: response });
        } catch (error) {
            return context.send.error(error);
        }
    }
}
