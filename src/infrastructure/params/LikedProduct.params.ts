import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class LikedProductParams {
  /** ID */
  @swaggerProperty({ type: 'string', required: false }) productId: string;
  @swaggerProperty({ type: 'array', items: { type: 'string' }, required: false }) productIds: Array<string>;

  constructor(params: any) {
    if (params) {
      this.productId = params?.productId;
      this.productIds = params?.productIds;
    }
  }

  async validate() {
    return await LikedProductParamsSchema.validateAsync(this);
  }
}

export const LikedProductParamsSchema = Joi.object<LikedProductParams>({
  productId: Joi.string().trim().optional().pattern(new RegExp('^[0-9a-fA-F]{24}$')),
  productIds: Joi.array()
    .items(Joi.string().trim().pattern(new RegExp('^[0-9a-fA-F]{24}$')))
    .optional(),
});
