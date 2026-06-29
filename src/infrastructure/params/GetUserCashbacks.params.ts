import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class GetUserCashbacksParams {
  @swaggerProperty({ type: 'array', items: { type: 'string' }, required: false }) storeIds?: Array<string>;

  constructor(params: any) {
    if (params) {
      this.storeIds = params?.storeIds;
    }
  }

  async validate() {
    return await GetUserCashbacksParamsSchema.validateAsync(this);
  }
}

export const GetUserCashbacksParamsSchema = Joi.object<GetUserCashbacksParams>({
  storeIds: Joi.array().items(Joi.string().trim()).optional(),
});
