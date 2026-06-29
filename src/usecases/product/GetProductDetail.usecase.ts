import { Types } from 'mongoose';
import { LanguageEnum, NotFoundError, Repository, ProductsModel, SpecialEventStatusEnum, ProductStatusEnum, CloudFlareService, CharacteristicsModel, Redis } from '@ubaytools/core';
import { ProductItemResponse } from '../../infrastructure';
import { ImanService } from '../../services/iman';
import { pipeline } from 'stream';

export class GetProductDetailUseCase {
  static async execute(productId: string, lang: LanguageEnum, userId?: string): Promise<ProductItemResponse> {

    const aggregatePipeline: any[] = [
      { $match: { _id: new Types.ObjectId(productId) } },

      // Store — only needed fields
      {
        $lookup: {
          from: 'stores',
          localField: 'store',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                avatar: 1,
                cashbackConfig: 1,
                storeStats: 1,
                // stats
              }
            }
          ],
          as: 'storeInfo',
        },
      },

      // Brand — only _id and title
      {
        $lookup: {
          from: 'brands',
          let: { brandId: '$infos.brand' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$brandId'] } } },
            { $project: { _id: 1, title: 1 } }
          ],
          as: 'brandInfo',
        },
      },

      // Flags — only name and color
      {
        $lookup: {
          from: 'flags',
          localField: 'infos.flags',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 1, name: 1, color: 1 } }
          ],
          as: 'flagsInfo',
        },
      },

      //  Category — only _id and name
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 1, name: 1 } }
          ],
          as: 'categoryInfo',
        },
      },

      // Special event
      {
        $lookup: {
          from: 'special_event_products',
          localField: '_id',
          foreignField: 'product',
          as: 'specialEventProduct',
        },
      },
      { $unwind: { path: '$specialEventProduct', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'special_events',
          localField: 'specialEventProduct.specialEvent',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 1, name: 1, status: 1, eventProductLimit: 1 } }
          ],
          as: 'specialEvent',
        },
      },
      { $unwind: { path: '$specialEvent', preserveNullAndEmptyArrays: true } },
    ];

    // User-specific lookups only if userId exists — skip for anonymous users
    if (userId) {
      aggregatePipeline.push(
        {
          $lookup: {
            from: 'liked_products',
            let: { productId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$user', userId] },
                      { $eq: ['$product', '$$productId'] },
                      { $eq: ['$isLiked', true] }
                    ]
                  }
                }
              },
              { $limit: 1 },             // stop after first match
              { $project: { _id: 1 } }   // only id needed
            ],
            as: 'userLikedProduct',
          },
        },
        {
          $lookup: {
            from: 'compares',
            let: { productId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$user', userId] },
                      { $eq: ['$product', '$$productId'] }
                    ]
                  }
                }
              },
              { $limit: 1 },             // stop after first match
              { $project: { _id: 1 } }   // only id needed
            ],
            as: 'userComparedProduct',
          },
        }
      );
    }

    // $addFields always last — after ALL lookups are done
    aggregatePipeline.push(
      {
        $addFields: {
          store: { $arrayElemAt: ['$storeInfo', 0] },
          brand: { $arrayElemAt: ['$brandInfo', 0] },
          category: { $arrayElemAt: ['$categoryInfo', 0] },
          // resolve to boolean directly, handle anonymous user
          isFavorite: userId
            ? { $gt: [{ $size: '$userLikedProduct' }, 0] }
            : false,
          addedCompare: userId
            ? { $gt: [{ $size: '$userComparedProduct' }, 0] }
            : false,
          specialEvent: {
            $cond: [
              { $eq: ['$specialEvent.status', SpecialEventStatusEnum.ACTIVE] },
              {
                _id: '$specialEvent._id',
                name: '$specialEvent.name',
                eventLimit: '$specialEvent.eventProductLimit',
                eventProductLimit: '$specialEventProduct.productLimit',
                discountPercent: '$specialEventProduct.discountPercent',
                discountPrice: '$specialEventProduct.discountPrice',
                isActive: '$specialEventProduct.isActive',
              },
              null,
            ],
          },
        },
      },
      // Drop temp arrays after $addFields — free memory immediately
      {
        $unset: [
          'storeInfo',
          'brandInfo',
          'categoryInfo',
          ...(userId ? ['userLikedProduct', 'userComparedProduct'] : []),
        ]
      }
    );
    const result = await ProductsModel.aggregate(aggregatePipeline);

    if (!result || result.length === 0) {
      throw new NotFoundError('Product');
    }
    console.log("lang: in product", lang);

    const productData = result[0];
    const baseLangCode = GetProductDetailUseCase.getBaseLanguage(lang);

    // Characteristics
    let characteristics = [];
    if (productData?.infos?.characteristics?.length) {
      const charIds = productData.infos.characteristics.map(
        (pair) => new Types.ObjectId(pair.key)
      );
      const charDocs = await CharacteristicsModel.find({
        _id: { $in: charIds }
      }).lean();
      const charMap = new Map(
        charDocs.map((doc) => [doc._id.toString(), doc.key?.[baseLangCode]])
      );
      characteristics = productData.infos.characteristics.map((pair) => ({
        key: charMap.get(pair.key.toString()) ?? 'Unknown',
        value: pair.value?.[baseLangCode] ?? '-',
      }));
    }

    const discountPrice = productData?.specialEvent?.isActive
      ? productData.specialEvent.discountPrice
      : productData?.infos?.discount_price;
    const price = discountPrice > 0 ? discountPrice : productData?.infos?.current_price;

    let installments = {};
    if (price && price >= 500000) {
      const redisClient = await Redis.getInstance();
      const imanCacheKey = `${process.env.NODE_ENV}:iman:installment-purchase-options:${price}`;
      const cached = await redisClient.get(imanCacheKey);
      if (cached) {
        installments["iman"] = JSON.parse(cached);
      } else {
        installments["iman"] = await ImanService.getInstance().calculatePurchaseOptions(price);
        await redisClient.set(imanCacheKey, JSON.stringify(installments["iman"]), 6 * 60 * 60);
      }
    }

    return new ProductItemResponse(productData, characteristics, installments, lang);
  }

  static async basicDetail(productIds: Types.ObjectId[], lang: LanguageEnum): Promise<any[]> {
    const aggregatePipeline = [
      {
        $match: { _id: { $in: productIds } },
      },
      {
        $lookup: {
          from: 'flags',
          localField: 'infos.flags',
          foreignField: '_id',
          as: 'flagsInfo',
        },
      },
      {
        $lookup: {
          from: "special_event_products",
          localField: "_id",
          foreignField: "product",
          as: "specialEventProduct"
        }
      },
      { $unwind: { path: "$specialEventProduct", preserveNullAndEmptyArrays: true } },

      // 3. Lookup SpecialEvent
      {
        $lookup: {
          from: "special_events",
          localField: "specialEventProduct.specialEvent",
          foreignField: "_id",
          as: "specialEvent"
        }
      },
      { $unwind: { path: "$specialEvent", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          flags: { $arrayElemAt: ['$flagsInfo', 0] },
          specialEvent: {
            $cond: [
              { $eq: ["$specialEvent.status", SpecialEventStatusEnum.ACTIVE] },
              {
                _id: "$specialEvent._id",
                name: "$specialEvent.name",
                eventLimit: "$specialEvent.eventProductLimit",
                eventProductLimit: "$specialEventProduct.productLimit",
                discountPercent: '$specialEventProduct.discountPercent',
                discountPrice: '$specialEventProduct.discountPrice',
                isActive: '$specialEventProduct.isActive'
              },
              null
            ]
          }
        },
      },
    ];

    const products = await ProductsModel.aggregate(aggregatePipeline);
    if (!products || products.length === 0) {
      return [];
    }

    return products;
  }

  static getBaseLanguage(lang: string): string {
    // Extract the base language code (e.g., 'en' from 'en-US')
    const baseLang = lang.split('-')[0].toLowerCase();

    // Map the base language to the supported languages in your system
    const supportedLanguages = ['en', 'ru', 'uz'];
    return supportedLanguages.includes(baseLang) ? baseLang : 'en'; // Default to 'en' if not supported
  }
}
