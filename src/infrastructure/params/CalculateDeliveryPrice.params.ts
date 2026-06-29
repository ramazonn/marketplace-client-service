import { PaymentTypeEnum } from '@ubaytools/core';
import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class CalculateDeliveryPriceParams {
  @swaggerProperty({
    type: 'array',
    items: { type: 'object', properties: { basketId: { type: 'string' } } },
    required: true,
    description: 'Basket item ids',
  })
  products: Array<{ basketId: string }>;
  @swaggerProperty({ type: 'string', description: Object.values(PaymentTypeEnum).join('|') }) paymentType: PaymentTypeEnum;
  @swaggerProperty({ type: 'string', required: false }) promoCode: string;


  constructor(params: any) {
    if (params) {
      this.products = params?.products;
      this.paymentType = params?.paymentType;
      this.promoCode = params?.promoCode;
    }
  }

  async validate() {
    return await CalculateDeliveryPriceParamsSchema.validateAsync(this);
  }
}

export const CalculateDeliveryPriceParamsSchema = Joi.object<CalculateDeliveryPriceParams>({
  products: Joi.array()
    .items(Joi.object({ basketId: Joi.string().required() }))
    .required()
    .min(1),
    paymentType: Joi.string().valid(
  PaymentTypeEnum.CLICK,
  PaymentTypeEnum.CLICK_QR,
  PaymentTypeEnum.CARD,
  PaymentTypeEnum.IMAN_PAY,
  PaymentTypeEnum.OTHER,
  PaymentTypeEnum.PAYME,
PaymentTypeEnum.UZUM).required(),
  promoCode: Joi.string().optional(),

});
