import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';
import { OrderStatusEnum } from '@ubaytools/core';

@swaggerClass()
export class OrderListParams {
  @swaggerProperty({ type: 'number', required: true }) page: number;
  @swaggerProperty({ type: 'number', required: true }) size: number;
  @swaggerProperty({ type: 'string', required: false, description: Object.values(OrderStatusEnum).join(' | ') + ' | ACTIVE' }) status: string;

  constructor(params: any) {
    if (params) {
      this.page = params?.page;
      this.size = params?.size;
      this.status = params?.status;
    }
  }

  async validate() {
    return await OrderListParamsSchema.validateAsync(this);
  }
}

export const OrderListParamsSchema = Joi.object<OrderListParams>({
  page: Joi.number().min(1).required(),
  size: Joi.number().min(1).required(),
  status: Joi.string().valid(...Object.values(OrderStatusEnum), 'ACTIVE'),
});
