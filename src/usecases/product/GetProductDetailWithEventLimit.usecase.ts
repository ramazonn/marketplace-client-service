import { Types } from 'mongoose';
import { LanguageEnum, NotFoundError, Repository, ProductsModel } from '@ubaytools/core';
import { SpecialEventProductItemResponse } from '../../infrastructure';

export class GetSpecialEventProductDetailUseCase {
  static async execute(productId: string, lang: LanguageEnum, eventProductLimit: number, discountPercent: number, discountPrice: number, userId?: string): Promise<SpecialEventProductItemResponse> {
    const aggregatePipeline = [
      {
        $match: { _id: new Types.ObjectId(productId) },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'product',
          as: 'reviews',
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'store',
          foreignField: '_id',
          as: 'storeInfo',
        },
      },
      {
        $lookup: {
          from: 'products',
          let: { storeId: '$store' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$store', '$$storeId'] }, { $eq: ['$status', 'CREATED'] }],
                },
              },
            },
          ],
          as: 'storeProducts',
        },
      },
      {
        $lookup: {
          from: 'reviews',
          let: { storeId: '$store' },
          pipeline: [
            {
              $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'pInfo',
              },
            },
            {
              $unwind: '$pInfo',
            },
            {
              $match: {
                $expr: {
                  $eq: ['$pInfo.store', '$$storeId'],
                },
              },
            },
          ],
          as: 'storeReviews',
        },
      },
      {
        $lookup: {
          from: 'liked_products',
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$user', userId] }, { $eq: ['$product', '$$productId'] }, { $eq: ['$isLiked', true] }],
                },
              },
            },
          ],
          as: 'userLikedProduct',
        },
      },
      {
        $lookup: {
          from: 'brands',
          let: { brandId: '$infos.brand' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$brandId'] },
              },
            },
          ],
          as: 'brandInfo',
        },
      },
      {
        $lookup: {
          from: 'models',
          let: { modelId: '$infos.model' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$modelId'] },
              },
            },
          ],
          as: 'modelInfo',
        },
      },
      {
        $lookup: {
          from: 'flags', // Adjust this to match your flags collection name
          localField: 'infos.flags',
          foreignField: '_id',
          as: 'flagsInfo',
        },
      },
      {
        $lookup: {
          from: 'categories', // Adjust this to match your categories collection name
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $addFields: {
          avgStars: { $avg: '$reviews.stars' },
          countOfReview: { $size: '$reviews' },
          store: { $arrayElemAt: ['$storeInfo', 0] },
          brand: { $arrayElemAt: ['$brandInfo', 0] },
          model: { $arrayElemAt: ['$modelInfo', 0] },
          storeProductCount: { $size: '$storeProducts' },
          storeAvgStars: { $avg: '$storeReviews.stars' },
          isFavorite: { $gt: [{ $size: '$userLikedProduct' }, 0] },
          category: { $arrayElemAt: ['$categoryInfo', 0] },
        },
      },
    ];

    const result = await ProductsModel.aggregate(aggregatePipeline);

    if (!result || result.length === 0) {
      throw new NotFoundError('Product');
    }

    const productData = result[0];

    const baseLang = GetSpecialEventProductDetailUseCase.getBaseLanguage(lang);
    const characteristics = await Promise.all(
      productData.infos.characteristics?.map(async (pair) => {
        const key = await Repository.Characteristics().getById(new Types.ObjectId(pair.key));
        return { key: key.getKey().getByLang(lang), value: pair.value?.[baseLang] };
      }),
    );


    return new SpecialEventProductItemResponse(productData, characteristics, lang, eventProductLimit, discountPercent, discountPrice);
  }

  static getBaseLanguage(lang: string): string {
    // Extract the base language code (e.g., 'en' from 'en-US')
    const baseLang = lang.split('-')[0].toLowerCase();

    // Map the base language to the supported languages in your system
    const supportedLanguages = ['en', 'ru', 'uz'];
    return supportedLanguages.includes(baseLang) ? baseLang : 'en'; // Default to 'en' if not supported
  }
}
