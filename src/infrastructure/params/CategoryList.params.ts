import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class CategoryListParams {
  @swaggerProperty({ type: 'string', required: false }) parent: string;
  @swaggerProperty({ type: 'number', required: true }) page: number;
  @swaggerProperty({ type: 'number', required: true }) size: number;

  constructor(params: any) {
    if (params) {
      this.parent = params?.parent;
      this.page = params?.page;
      this.size = params?.size;
    }
  }

  async validate() {
    return await CategoryListParamsSchema.validateAsync(this);
  }
}

export const CategoryListParamsSchema = Joi.object<CategoryListParams>({
  parent: Joi.string().allow(null),
  page: Joi.number().min(1).required(),
  size: Joi.number().min(1).required(),
});
