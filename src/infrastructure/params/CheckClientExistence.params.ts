import * as Joi from 'joi';

export class CheckClientExistenceParams {
  /** Номер телефона */
  phoneNumber: string;
  /** SMS signature for auto-fill functionality */
  signature?: string;

  constructor(params: any) {
    if (params) {
      this.phoneNumber = params?.phoneNumber;
      this.signature = params?.signature;
    }
  }

  async validate() {
    return await CheckClientExistenceParamsSchema.validateAsync(this);
  }
}

export const CheckClientExistenceParamsSchema = Joi.object<CheckClientExistenceParams>({
  phoneNumber: Joi.string().trim().required().regex(new RegExp('^[0-9]{12}$')),
  signature: Joi.string().trim().optional().max(15).description('SMS signature for auto-fill functionality'),
});
