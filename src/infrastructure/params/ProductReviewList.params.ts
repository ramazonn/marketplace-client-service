import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class ProductReviewListParams {
  @swaggerProperty({ type: 'number', required: true }) page: number;
  @swaggerProperty({ type: 'number', required: true }) size: number;
  @swaggerProperty({ type: 'string', required: true }) product: string;

  constructor(params: any) {
    if (params) {
      this.page = params?.page;
      this.size = params?.size;
      this.product = params?.product;
    }
  }

  async validate() {
    return await ProductReviewListParamsSchema.validateAsync(this);
  }
}

export const ProductReviewListParamsSchema = Joi.object<ProductReviewListParams>({
  page: Joi.number().min(1).required(),
  size: Joi.number().min(1).required(),
  product: Joi.string().trim().required(),
});
