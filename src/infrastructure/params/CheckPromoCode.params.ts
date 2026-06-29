import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class CheckPromoCodeParams {
  @swaggerProperty({ type: 'string', required: true })
  code: string;

  @swaggerProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        basketId: { type: 'string' },
      },
    },
    required: false,
  })
  products: Array<{ basketId: string }>;

  constructor(params: any) {
    if (params) {
      this.code = params?.code;
      this.products = params?.products;
    }
  }

  async validate() {
    return await CheckPromoCodeParamsSchema.validateAsync(this);
  }
}

export const CheckPromoCodeParamsSchema = Joi.object<CheckPromoCodeParams>({
  code: Joi.string().required().uppercase(),

  products: Joi.array()
    .items(
      Joi.object({
        basketId: Joi.string().required(),
      }),
    )
    .optional(),
});
