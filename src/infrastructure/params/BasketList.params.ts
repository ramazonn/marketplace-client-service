import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class BasketListParams {
  @swaggerProperty({ type: 'number', required: true }) page: number;
  @swaggerProperty({ type: 'number', required: true }) size: number;
  @swaggerProperty({ type: 'array', items: { type: 'string' } }) basketIds: Array<string>;

  constructor(params: any) {
    if (params) {
      this.page = params?.page;
      this.size = params?.size;
      if (params?.basketIds) {
        this.basketIds = params.basketIds.split(',').map((id) => id.trim());
      }
    }
  }

  async validate() {
    return await BasketListParamsSchema.validateAsync(this);
  }
}

export const BasketListParamsSchema = Joi.object<BasketListParams>({
  page: Joi.number().min(1).required(),
  size: Joi.number().min(1).required(),
  basketIds: Joi.array().items(Joi.string().trim()).optional(),
});
