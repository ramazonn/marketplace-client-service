import * as Joi from 'joi';

export class PhoneNumberParams {
  /** Phone number */
  phoneNumber: string;

  constructor(params: any) {
    if (params) {
      this.phoneNumber = params?.phoneNumber;
    }
  }

  async validate() {
    return await phoneNumberParams.validateAsync(this);
  }
}

export const phoneNumberParams = Joi.object<PhoneNumberParams>({
  phoneNumber: Joi.string().trim().required().pattern(new RegExp('^[0-9]{12}$')),
});
