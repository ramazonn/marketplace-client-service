import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';
import { ProductListFilterSwaggerSchema } from '../schemas';

export class ProductListFilterSchema  {
  category: string;
  brands: string[];
  models: string[];
  store: string;
  price: { from: number; to: number };
  color: string;
  rating: number;
  isFavorite: boolean;
};
@swaggerClass()
export class ProductListParams {
  @swaggerProperty({
    type: 'object',
    properties: ProductListFilterSwaggerSchema,
    required: false,
  })
  filter: ProductListFilterSchema;
  @swaggerProperty({ type: 'string', required: false }) search: string;
  @swaggerProperty({ type: 'string', required: false, description: 'sorting key' }) sort: string;

  constructor(params: any) {
    if (params) {
      this.filter = params?.filter;
      this.search = params?.search;
      this.sort = params?.sort;
    }
  }

  async validate() {
    return await ProductListParamsSchema.validateAsync(this);
  }
}

export const ProductListParamsSchema = Joi.object<ProductListParams>({
  search: Joi.string().trim().optional(),
  filter:{
    category: Joi.string().trim().optional(),
    brands: Joi.array().items(Joi.string().trim()).optional(),
    models: Joi.array().items(Joi.string().trim()).optional(),
    store: Joi.string().trim().optional(),
    price: Joi.object().optional(),
    color: Joi.string().trim().optional(),
    rating: Joi.number().optional(),
    isFavorite: Joi.boolean().optional(),
  } ,//Joi.object().optional(),
  sort: Joi.string().trim().optional(),
});
