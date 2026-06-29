import { prefix, request, security, summary, tags, query } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CompareModel, NotFoundError, Repository, ProductsModel, CharacteristicsModel } from '@ubaytools/core';
import { Types } from 'mongoose';
import { getBaseLanguage } from '../../utils';
import { GetProductDetailUseCase } from '../../usecases';
import { CategoryIdRequiredError } from '../../infrastructure/errors/CategoryIdRequired.error';

@prefix('/compare')
export default class GetCompareDetailsController {
  @request('get', '/result')
  @summary('Get compare details')
  @security([])
  @tags(['Compare'])
  @query({
    category: { type: 'string', required: true, description: 'Category ID to filter products' },
  })
  static async controller(context: Context): Promise<void> {
    try {
      const user = context.client;
      const { category } = context.request.query;

      if (!user) {
        throw new NotFoundError('User');
      }

      if (!category) {
        throw new CategoryIdRequiredError();
      }

      const aggregationPipeline = [
        {
          $match: {
            user: user.getId(),
            category: new Types.ObjectId(category as string),
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productInfo',
          },
        },
        {
          $unwind: '$productInfo',
        },
        {
          $project: {
            _id: 0,
            productId: '$productInfo._id',
            characteristics: '$productInfo.infos.characteristics',
          },
        },
      ];

      const products = await CompareModel.aggregate(aggregationPipeline);

      const baseLang = getBaseLanguage(context.lang);
      const allCharacteristics = new Set();

      // First pass: collect all unique characteristic keys
      products.forEach((product) => {
        product.characteristics.forEach((char) => {
          allCharacteristics.add(char.key);
        });
      });

      // Fetch all characteristic keys and their values
      const characteristicKeys = await CharacteristicsModel.find({
        _id: { $in: Array.from(allCharacteristics) },
      }).lean();

      const characteristicKeysMap = new Map(characteristicKeys.map((char) => [char._id.toString(), char.key[baseLang]]));

      // Second pass: structure the data and fill in missing characteristics
      const structuredProducts = await Promise.all(
        products.map(async (product) => {
          const characteristicsMap = new Map(product.characteristics.map((char) => [char.key, char.value[baseLang]]));
          const result = await GetProductDetailUseCase.execute(product.productId.toString(), context.lang, user.getId());
          result.characteristics = Array.from(allCharacteristics).map((keyId) => ({
            key: (characteristicKeysMap.get(keyId.toString()) || 'Unknown') as string,
            value: (characteristicsMap.get(keyId.toString()) || '-') as string,
          }));
          return result;
        }),
      );

      return context.send.data({
        category: category,
        products: structuredProducts,
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
