import * as Joi from 'joi';

export class AuthLoginParams {
  /** Номер телефона */
  phoneNumber: string;

  /** Пароль */
  password: string;

  constructor(params: any) {
    if (params) {
      this.phoneNumber = params?.phoneNumber;
      this.password = params?.password;
    }
  }

  async validate() {
    return await AuthLoginParamsSchema.validateAsync(this);
  }
}

export const AuthLoginParamsSchema = Joi.object<AuthLoginParams>({
  phoneNumber: Joi.string().trim().required().regex(new RegExp('^[0-9]{12}$')),
  password: Joi.string().trim().required(),
});
