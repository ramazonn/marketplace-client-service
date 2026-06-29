import * as Joi from 'joi';
import { GenderEnum } from '@ubaytools/core';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class SetClientAvatarParams {
  @swaggerProperty({ type: 'string', required: true }) avatar: string;
  constructor(params: any) {
    if (params) {
      this.avatar = params?.avatar;
    }
  }

  async validate() {
    return await SetClientAvatarParamsSchema.validateAsync(this);
  }
}

export const SetClientAvatarParamsSchema = Joi.object<SetClientAvatarParams>({
  avatar: Joi.string().trim().required()
});
