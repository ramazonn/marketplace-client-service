import { Types } from 'mongoose';
import {
    LanguageEnum,
    ProductEntity,
    Redis,
    Repository,
    SpecialEventEntity,
    SpecialEventProductEntity,
    SpecialEventStatusEnum,
} from '@ubaytools/core';
import { SpecialEventProductItemResponse } from '../../infrastructure';
import { GetSpecialEventProductDetailUseCase } from '../product/GetProductDetailWithEventLimit.usecase';

type SpecialEventBasicCacheItem = {
    id: string;
    name: string;
    description: string;
    backgroundImageMobile: string;
    backgroundImageWeb: string;
    startAt: Date | null;
    endAt: Date | null;
    daysOfWeek: number[];
    eventProductLimit: number;
    eventLimitDuration: number;
    status: SpecialEventStatusEnum;
    productsCount: number;
};

type SpecialEventProductMeta = {
    productId: string;
    discountPercent: number;
    discountPrice: number;
    productLimit: number;
};

type SpecialEventMetaCacheItem = {
    id: string;
    products: SpecialEventProductMeta[];
};

class SpecialEventListItemResponse {
    id: string;
    name: string;
    description: string;
    backgroundImageMobile: string;
    backgroundImageWeb: string;
    startAt: Date | null;
    endAt: Date | null;
    daysOfWeek: number[];
    eventProductLimit: number;
    eventLimitDuration: number;
    status: SpecialEventStatusEnum;
    products: SpecialEventProductItemResponse[];

    constructor(basic: SpecialEventBasicCacheItem, products: SpecialEventProductItemResponse[]) {
        this.id = basic.id;
        this.name = basic.name;
        this.description = basic.description;
        this.backgroundImageMobile = basic.backgroundImageMobile;
        this.backgroundImageWeb = basic.backgroundImageWeb;
        this.startAt = basic.startAt;
        this.endAt = basic.endAt;
        this.daysOfWeek = basic.daysOfWeek;
        this.eventProductLimit = basic.eventProductLimit ?? 0;
        this.eventLimitDuration = basic.eventLimitDuration ?? 0;
        this.status = basic.status;
        this.products = products ?? [];
    }
}

export class GetActiveSpecialEventsUseCase {
    static async execute(page: number, size: number, lang: LanguageEnum, userId?: string | null) {
        const redisClient = await Redis.getInstance();

        
        const countKey = this.getCountKey();
        const basicListKey = this.getBasicListKey(page, size, lang);

        let count = await this.getCachedCount(redisClient, countKey);

        let basicList = await this.getCachedBasicList(redisClient, basicListKey);

        if (!basicList || !Array.isArray(basicList) || basicList.length === 0) {
            const specialEvents = await Repository.SpecialEvents().list(
                { page, size },
                { status: SpecialEventStatusEnum.ACTIVE },
            );

            const activeEvents = specialEvents.filter((event) => this.isEventActiveNow(event));
            basicList = activeEvents.map((event) => this.mapEventToBasicCache(event, lang));

            await redisClient.set(basicListKey, JSON.stringify(basicList), 24 * 60 * 60);

            count = basicList.length;
            await redisClient.set(countKey, count.toString(), 24 * 60 * 60);
        }

        if (!basicList.length) {
            return { total: count, items: [] };
        }

        const eventMetaMap = await this.getEventMetaMap(redisClient, basicList, lang);

        const eventProductMap = await this.getEventProductMap(redisClient, basicList, eventMetaMap, lang);

        /**
        * VAQTINCHA O‘CHIRILDI:
        * Cache sinovlari uchun isFavorite / isLiked tekshiruvlari vaqtincha o‘chirildi.
        * TODO: test tugagandan keyin qayta yoqish kerak.
        */
       
        // if (userId) {
        //     await this.applyUserFavorites(userId, eventProductMap);
        // }

        const items = basicList.map((basic) => {
            const meta = eventMetaMap.get(basic.id);

            const products = (meta?.products ?? [])
                .map((item) => eventProductMap.get(this.getEventProductMapKey(basic.id, item.productId)))
                .filter((item): item is SpecialEventProductItemResponse => item !== undefined);

            return new SpecialEventListItemResponse(basic, products);
        });

        return { total: count, items };
    }

    private static async getCachedCount(redisClient: any, countKey: string): Promise<number> {
        const cachedCount = await redisClient.get(countKey);

        if (cachedCount === null || cachedCount === undefined) {
            return 0;
        }

        return parseInt(cachedCount, 10) || 0;
    }

    private static async getCachedBasicList(
        redisClient: any,
        basicListKey: string,
    ): Promise<SpecialEventBasicCacheItem[] | null> {
        const cachedBasicList = await redisClient.get(basicListKey);

        return this.safeJsonParse<SpecialEventBasicCacheItem[]>(cachedBasicList);
    }

    private static async getEventMetaMap(
        redisClient: any,
        basicList: SpecialEventBasicCacheItem[],
        lang: LanguageEnum,
    ): Promise<Map<string, SpecialEventMetaCacheItem>> {
        const eventMetaKeys = basicList.map((event) => this.getEventMetaKey(event.id, lang));
        const cachedEventMetaList = await this.safeMget(redisClient, eventMetaKeys);

        const eventMetaMap = new Map<string, SpecialEventMetaCacheItem>();
        const missingEventIds = new Set<string>();

        for (let i = 0; i < basicList.length; i++) {
            const basic = basicList[i];
            const parsed = this.safeJsonParse<SpecialEventMetaCacheItem>(cachedEventMetaList[i]);

            if (!parsed?.products) {
                missingEventIds.add(basic.id);
                continue;
            }

            eventMetaMap.set(basic.id, parsed);
        }

        if (missingEventIds.size > 0) {
            const pipeline = await redisClient.pipeline();
            let hasPipelineItems = false;

            for (const eventId of Array.from(missingEventIds)) {
                const event = await Repository.SpecialEvents().getById(new Types.ObjectId(eventId));
                if (!event || !this.isEventActiveNow(event)) continue;
                const eventMeta: SpecialEventMetaCacheItem = {
                    id: event.getId().toString(),
                    products: event.getActiveProducts().map(
                        (specialEventProduct: SpecialEventProductEntity) => {
                            const product = specialEventProduct.getProduct() as ProductEntity;

                            return {
                                productId: product.getId().toString(),
                                discountPercent: specialEventProduct.getDiscountPercent(),
                                discountPrice: specialEventProduct.getDiscountPrice(),
                                productLimit: specialEventProduct.getProductLimit(),
                            };
                        },
                    ),
                };

                eventMetaMap.set(eventMeta.id, eventMeta);

                const eventMetaKey = this.getEventMetaKey(eventMeta.id, lang);

                pipeline.set(
                    eventMetaKey,
                    JSON.stringify(eventMeta),
                    { EX: 24 * 60 * 60 },
                );
                hasPipelineItems = true;
            }

            if (hasPipelineItems) {
                await pipeline.exec();
            }
        }

        return eventMetaMap;
    }

    private static async getEventProductMap(
        redisClient: any,
        basicList: SpecialEventBasicCacheItem[],
        eventMetaMap: Map<string, SpecialEventMetaCacheItem>,
        lang: LanguageEnum,
    ): Promise<Map<string, SpecialEventProductItemResponse>> {
        const allEventProductRefs: Array<{
            eventId: string;
            productId: string;
            discountPercent: number;
            discountPrice: number;
            productLimit: number;
        }> = [];

        for (const basic of basicList) {
            const meta = eventMetaMap.get(basic.id);
            if (!meta?.products?.length) continue;

            for (const productMeta of meta.products) {
                allEventProductRefs.push({
                    eventId: basic.id,
                    productId: productMeta.productId,
                    discountPercent: productMeta.discountPercent,
                    discountPrice: productMeta.discountPrice,
                    productLimit: productMeta.productLimit,
                });
            }
        }


        const eventProductKeys = allEventProductRefs.map((item) =>
            this.getEventProductKey(item.eventId, item.productId, lang),
        );

        const cachedEventProducts = await this.safeMget(redisClient, eventProductKeys);


        const eventProductMap = new Map<string, SpecialEventProductItemResponse>();
        const missingEventProducts: typeof allEventProductRefs = [];

        for (let i = 0; i < allEventProductRefs.length; i++) {
            const ref = allEventProductRefs[i];
            const parsed = this.safeJsonParse<SpecialEventProductItemResponse>(cachedEventProducts[i]);
            const mapKey = this.getEventProductMapKey(ref.eventId, ref.productId);

            if (!parsed) {
                missingEventProducts.push(ref);
                continue;
            }

            parsed.isFavorite = false;
            eventProductMap.set(mapKey, parsed);
        }

        if (missingEventProducts.length > 0) {
            const pipeline = await redisClient.pipeline();
            let hasPipelineItems = false;

            for (const ref of missingEventProducts) {
                const product = await GetSpecialEventProductDetailUseCase.execute(
                    ref.productId,
                    lang,
                    ref.productLimit,
                    ref.discountPercent,
                    ref.discountPrice,
                );

                if (!product) continue;

                product.isFavorite = false;
                eventProductMap.set(this.getEventProductMapKey(ref.eventId, ref.productId), product);

                const eventProductKey = this.getEventProductKey(ref.eventId, ref.productId, lang);

                pipeline.set(
                    eventProductKey,
                    JSON.stringify(product),
                    { EX: 24 * 60 * 60 },
                );
                hasPipelineItems = true;
            }

            if (hasPipelineItems) {
                await pipeline.exec();
            }
        }

        return eventProductMap;
    }

    private static async applyUserFavorites(
        userId: string,
        eventProductMap: Map<string, SpecialEventProductItemResponse>,
    ): Promise<void> {
        const uniqueProductIds = Array.from(
            new Set(Array.from(eventProductMap.values()).map((item) => item.id)),
        );

        if (!uniqueProductIds.length) return;

        const likedProducts = await Repository.UserLikedProducts().list(
            { page: 1, size: uniqueProductIds.length },
            {
                user: new Types.ObjectId(userId),
                isLiked: true,
                product: { $in: uniqueProductIds.map((id) => new Types.ObjectId(id)) },
            },
        );




        const likedMap = new Map<string, boolean>();

        for (const likedProduct of likedProducts) {
            const pid = (likedProduct.getProduct() as ProductEntity)?.getId()?.toString();
            if (pid) likedMap.set(pid, true);
        }


        for (const [, product] of eventProductMap) {
            product.isFavorite = likedMap.get(product.id) ?? false;
        }
    }

    private static async safeMget(redisClient: any, keys: string[]): Promise<string[]> {
        if (!keys.length) {
            return [];
        }

        return await redisClient.mget(keys);
    }

    private static safeJsonParse<T>(value: string | null | undefined): T | null {
        if (!value) return null;

        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    

    private static getCountKey(): string {
        return `${process.env.NODE_ENV}:special-event:count`;
    }

    private static getBasicListKey(page: number, size: number, lang: LanguageEnum): string {
        return `${process.env.NODE_ENV}:special-event:list:basic:${page}:${size}:${lang}`;
    }

    private static getEventMetaKey(eventId: string, lang: LanguageEnum): string {
        return `${process.env.NODE_ENV}:special-event:${eventId}:${lang}`;
    }

    private static getEventProductKey(
        eventId: string,
        productId: string,
        lang: LanguageEnum,
    ): string {
        return `${process.env.NODE_ENV}:special-event:product:${eventId}:${productId}:${lang}`;
    }

    private static getEventProductMapKey(eventId: string, productId: string): string {
        return `${eventId}:${productId}`;
    }

    private static isEventActiveNow(event: SpecialEventEntity): boolean {
        const today = new Date();
        const startDate = event.getStartAt() ? new Date(event.getStartAt()) : null;
        const endDate = event.getEndAt() ? new Date(event.getEndAt()) : null;
        const daysOfWeek = event.getDaysOfWeek() ?? [];

        if (startDate && endDate) {
            return today >= startDate && today <= endDate;
        }

        if (daysOfWeek.length > 0) {
            return daysOfWeek.includes(today.getDay());
        }

        return true;
    }

    private static mapEventToBasicCache(
        event: SpecialEventEntity,
        lang: LanguageEnum,
    ): SpecialEventBasicCacheItem {
        return {
            id: event.getId().toString(),
            name: event.getName().getByLang(lang),
            description: event.getDescription().getByLang(lang),
            backgroundImageMobile: event.getBackgroundImageMobile(),
            backgroundImageWeb: event.getBackgroundImageWeb(),
            startAt: event.getStartAt() ?? null,
            endAt: event.getEndAt() ?? null,
            daysOfWeek: event.getDaysOfWeek() ?? [],
            eventProductLimit: event.getEventProductLimit() ?? 0,
            eventLimitDuration: event.getEventLimitDuration() ?? 0,
            status: event.getStatus(),
            productsCount: event.getActiveProducts()?.length ?? 0,
        };
    }
}