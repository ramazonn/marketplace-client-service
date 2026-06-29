import * as Joi from 'joi';

export class ConfirmationValidateParams {
  /** Номер телефона */
  code: string;

  constructor(params: any) {
    if (params) {
      this.code = params?.code;
    }
  }

  async validate() {
    return await ConfirmationValidateParamsSchema.validateAsync(this);
  }
}

export const ConfirmationValidateParamsSchema = Joi.object<ConfirmationValidateParams>({
  code: Joi.string().trim().required().regex(new RegExp('^[0-9]{6}$')),
});
