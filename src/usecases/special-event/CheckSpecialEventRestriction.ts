import { LanguageEnum, Redis, Repository, SpecialEventStatusEnum } from "@ubaytools/core";
import { Types } from "mongoose";
import { GetActiveSpecialEvents } from "./GetActiveSpecialEvents";

export class CheckSpecialEventRestriction {
    private static readonly fridayPromoCacheKey = `${process.env.NODE_ENV}special-events:friday:uz:active`;

    static async execute(productId: Types.ObjectId, lang: LanguageEnum, userId?: string): Promise<boolean> {
        const specialEvents = await GetActiveSpecialEvents.execute(lang, userId);
        const specialEvent = specialEvents.find((event) => event.products.some((product) => product.id === productId.toString()));
        if (!specialEvent) return true;
        if (specialEvent.eventProductLimit > 0 && specialEvent.products.length >= specialEvent.eventProductLimit) return false;
        if (userId) {
            const userLikedProducts = await Repository.UserLikedProducts().getLikedProductByUser(new Types.ObjectId(userId), productId);
            if (userLikedProducts && Array.isArray(userLikedProducts) && userLikedProducts.length >= specialEvent.eventProductLimit) return false;
        }
        const specialEventProduct = specialEvent.products.find((product) => product.id === productId.toString());
        if (!specialEventProduct) return false;
        return true;
    }

    static async checkFridayPromotion(): Promise<{
        isFridayPromotion: boolean;
        specialEvent: null | {
            id: string;
            eventProductLimit: number;
            eventLimitDuration: number;
        };
    }> {
        const redisClient = await Redis.getInstance();

        // await redisClient.delete(this.fridayPromoCacheKey); 
        
        const cached = await redisClient.get(this.fridayPromoCacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached) as {
                    isFridayPromotion: boolean;
                    specialEvent: null | {
                        id: string;
                        eventProductLimit: number;
                        eventLimitDuration: number;
                    };
                };
                if (typeof parsed?.isFridayPromotion === 'boolean') return parsed;
            } catch (e) {
                // ignore corrupted cache; fall back to DB fetch
            }
        }

        // Friday promo: avoid loading event products (can be 100-1000+ items).
        // We only need the event meta (limits + endAt) and later check product membership via SpecialEventProducts().
        const specialEvents = await Repository.SpecialEvents().list(
            { page: 1, size: 100 },
            { status: SpecialEventStatusEnum.ACTIVE },
        );

        // NOTE: Repository.SpecialEvents().list(...) already filters by status in most implementations.
        // If the second param is ignored by your repository, we still safely handle "no friday event found".
        const today = new Date();

        const isEventActiveNow = (event: any): boolean => {
            const startAt = typeof event.getStartAt === 'function' ? event.getStartAt() : null;
            const endAt = typeof event.getEndAt === 'function' ? event.getEndAt() : null;
            const daysOfWeek = typeof event.getDaysOfWeek === 'function' ? event.getDaysOfWeek() : [];

            const startDate = startAt ? new Date(startAt) : null;
            const endDate = endAt ? new Date(endAt) : null;

            if (startDate && endDate) {
                return today >= startDate && today <= endDate;
            }

            if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
                return daysOfWeek.includes(today.getDay());
            }

            return true;
        };

        const fridayEvent = specialEvents.find(
            (event: any) => {
                const daysOfWeek = typeof event.getDaysOfWeek === 'function' ? event.getDaysOfWeek() : [];
                return isEventActiveNow(event) && Array.isArray(daysOfWeek) && daysOfWeek.includes(5);
            },
        );

        if (!fridayEvent) {
            const value = { isFridayPromotion: false, specialEvent: null };
            // Friday promo is unlikely to appear within seconds; keep negative cache short.
            await redisClient.set(this.fridayPromoCacheKey, JSON.stringify(value), 60 * 5);
            return value;
        }

        const value = {
            isFridayPromotion: true,
            specialEvent: {
                id: fridayEvent.getId().toString(),
                eventProductLimit: fridayEvent.getEventProductLimit(),
                eventLimitDuration: fridayEvent.getEventLimitDuration() ?? 0,
            },
        };

        // Cache until the event end time if available; otherwise until next midnight (server time).
        const now = Date.now();
        const endAt = typeof (fridayEvent as any).getEndAt === 'function' ? (fridayEvent as any).getEndAt() : null;
        let ttlSeconds = 60 * 60; // fallback: 1h
        if (endAt) {
            const endMs = new Date(endAt).getTime();
            ttlSeconds = Math.max(60, Math.floor((endMs - now) / 1000));
        } else {
            const nextMidnight = new Date();
            nextMidnight.setHours(24, 0, 0, 0);
            ttlSeconds = Math.max(60, Math.floor((nextMidnight.getTime() - now) / 1000));
        }

        await redisClient.set(this.fridayPromoCacheKey, JSON.stringify(value), ttlSeconds);
        return value;
    }

    static async isFridayPromotionProduct(
  productId: Types.ObjectId,
  specialEventId: Types.ObjectId,
): Promise<{
  isFridayPromotionProduct: boolean;
  discountPrice: number | null;
}> {
  const specialEventProduct = await Repository.SpecialEventProducts().findByProductAndSpecialEvent(
    productId,
    specialEventId,
  );

  if (!specialEventProduct) {
    return {
      isFridayPromotionProduct: false,
      discountPrice: null,
    };
  }

  const isActive =
    (specialEventProduct as any)?.getIsActive?.() ??
    (specialEventProduct as any)?._isActive;

  if (isActive !== true) {
    return {
      isFridayPromotionProduct: false,
      discountPrice: null,
    };
  }

  const discountPrice =
    (specialEventProduct as any)?.getDiscountPrice?.() ??
    (specialEventProduct as any)?._discountPrice ??
    null;

  return {
    isFridayPromotionProduct: true,
    discountPrice: typeof discountPrice === 'number' ? discountPrice : null,
  };
}



    static async checkFridayPromotionOrderLimitReached(userId: Types.ObjectId, fridayEventlimit: number, fridayEventlimitDuration: number, specialEventId?: Types.ObjectId): Promise<boolean> {
        if (!fridayEventlimitDuration) {
            return false
        }
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - fridayEventlimitDuration)
        fromDate.setHours(0, 0, 0, 0)
        const toDate = new Date();
        toDate.setHours(23, 59, 59, 999);
        // TODO: special-eventslar ko'payishni boshlasa aynan qaysi special-event bo'yichaligini ham tekshirish
        const specialEventOrdersCount = await Repository.SpecialEventOrders().countDocumentsByFilter({
            user: userId.toString(),
            createdAt: { $gte: fromDate, $lte: toDate },
            ...(specialEventId
                ? { specialEvent: { $in: [specialEventId, specialEventId.toString()] } }
                : {}),
        });
        return specialEventOrdersCount >= fridayEventlimit;
    }

    static async checkFridayPromotionBasketLimitReached(userId: string, specialEventId: Types.ObjectId, eventProductLimit: number): Promise<boolean> {
        const currentEventProductsCount = await Repository.UserLikedProducts().countDocumentsByFilter({
            user: userId,
            inBasked: true,
            specialEvent: { $in: [specialEventId, specialEventId.toString()] },
        });
        return currentEventProductsCount >= eventProductLimit;
    }

    static async productLevelRestriction(productId: Types.ObjectId, lang: LanguageEnum, userId: Types.ObjectId, userBasketProductCount: number): Promise<boolean> {
        const specialEvents = await GetActiveSpecialEvents.execute(lang, userId.toString());
        const specialEvent = specialEvents.find((event) =>
            event.products.some((product) => product.id === productId.toString())
        );

        if (!specialEvent) return false;

        const specialEventProduct = specialEvent.products.find((product) =>
            product.id === productId.toString()
        );

        if (!specialEventProduct) return false;

        if (!specialEventProduct.eventProductLimit || specialEventProduct.eventProductLimit === 0) return false;

        return userBasketProductCount > specialEventProduct.eventProductLimit;
    }
}