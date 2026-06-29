import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { GetProductDetailUseCase } from '../../usecases';
import { LanguageEnum } from '@ubaytools/core';

@prefix('/product')
export default class CompareProductsController {
  @request('post', '/compare')
  @summary('Products compare characteristics')
  @security([])
  @tags(['Product'])
  @body({ productIds: { type: 'array', items: { type: 'string' } } })
  static async controller(context: Context): Promise<void> {
    try {
      const productIds = (context.request.body as any)?.productIds;
      if (!productIds || productIds?.length < 2) {
        throw new Error('At least two product ids must be provided');
      }
      const lang = context.lang as LanguageEnum;
      const products = await Promise.all(productIds.map((id) => GetProductDetailUseCase.execute(id, lang)));

      const characteristicsMap = new Map();

      products.forEach((product) => {
        product.characteristics.forEach((char) => {
          if (!characteristicsMap.has(char.key)) {
            characteristicsMap.set(char.key, { key: char.key, values: [] });
          }
          characteristicsMap.get(char.key).values.push({
            productId: product.id,
            value: char.value,
          });
        });
      });

      const comparisonResult = Array.from(characteristicsMap.values());

      return context.send.data(comparisonResult);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
