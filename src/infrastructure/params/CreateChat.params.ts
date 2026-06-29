import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';
import { DeliveryAddressTypeEnum, PaymentTypeEnum } from '@ubaytools/core';

@swaggerClass()
export class CreateChatParams {
  @swaggerProperty({ type: 'string', required: true }) title: string;
  @swaggerProperty({ type: 'string', required: true }) store: string;
  @swaggerProperty({ type: 'object', required: false }) extraData: object;

  constructor(params: any) {
    if (params) {
      this.title = params?.title;
      this.store = params?.store;
      this.extraData = params?.extraData;
    }
  }

  async validate() {
    return await CreateChatParamsSchema.validateAsync(this);
  }
}

export const CreateChatParamsSchema = Joi.object<CreateChatParams>({
  title: Joi.string().trim().required(),
  store: Joi.string().trim().required(),
  extraData: Joi.object().optional(),
});
