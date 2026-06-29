import * as Joi from 'joi';

export class CheckClientResetAccountParams {
  /** Номер телефона */
  phoneNumber: string;

  constructor(params: any) {
    if (params) {
      this.phoneNumber = params?.phoneNumber;
    }
  }

  async validate() {
    return await CheckClientResetAccountParamsSchema.validateAsync(this);
  }
}

export const CheckClientResetAccountParamsSchema = Joi.object<CheckClientResetAccountParams>({
  phoneNumber: Joi.string().trim().required().regex(new RegExp('^[0-9]{12}$')),
});
