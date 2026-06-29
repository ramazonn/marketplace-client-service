import * as Joi from 'joi';
import { LanguageEnum } from '@ubaytools/core';

export class UpdateClientLanguageParams {

  language: LanguageEnum;

  constructor(params: any) {
    if (params) {
      this.language = params?.language;
    }
  }

  async validate() {
    return await UpdateClientLanguageParamsSchema.validateAsync(this);
  }
}

export const UpdateClientLanguageParamsSchema = Joi.object<UpdateClientLanguageParams>({
  language: Joi.string().trim().required().valid(...Object.values(LanguageEnum)),
});
