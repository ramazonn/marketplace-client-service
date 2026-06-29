import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class WriteReviewParams {
  @swaggerProperty({ type: 'number', required: true }) stars: number;
  @swaggerProperty({ type: 'string', required: false }) advantages: string;
  @swaggerProperty({ type: 'string', required: false }) disadvantages: string;
  @swaggerProperty({ type: 'string', required: false }) description: string;
  @swaggerProperty({ type: 'string', required: true, description: 'product id' }) product: string;
  @swaggerProperty({ type: 'string', required: true, description: 'store order id' }) order: string;
  @swaggerProperty({ type: 'array', items: { type: 'string' }, required: false }) attachments: Array<string>;

  constructor(params: any) {
    this.product = params?.product;
    this.order = params?.order;
    this.stars = params?.stars;
    this.advantages = params?.advantages;
    this.disadvantages = params?.disadvantages;
    this.description = params?.description;
    this.attachments = params?.attachments;
    }

  async validate() {
    return await WriteReviewSchema.validateAsync(this);
  }
}

export const WriteReviewSchema = Joi.object<WriteReviewParams>({
  product: Joi.string().trim().required(),
  order: Joi.string().trim().required(),
  stars: Joi.number().required(),
  advantages: Joi.string().trim().optional(),
  disadvantages: Joi.string().trim().optional(),
  description: Joi.string().trim().optional(),
  attachments: Joi.array().items(Joi.string()).optional(),
});
