import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class ImanCalculatePurchaseOptionsParams {
  @swaggerProperty({ type: 'number', required: true })   totalAmount: number;

  constructor(params: any) {
    this.totalAmount = params?.totalAmount;
  }

  async validate() {
    return await ImanCalculatePurchaseOptionsSchema.validateAsync(this);
  }
}

export const ImanCalculatePurchaseOptionsSchema = Joi.object<ImanCalculatePurchaseOptionsParams>({
  totalAmount: Joi.number().required()
});
