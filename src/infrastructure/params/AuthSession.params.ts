import * as Joi from 'joi';

export class AuthSessionParams {
  /** Добавить доверенное устройство */
  trustedDevice: boolean;

  /** Сеанс метаданных */
  metaData: any;

  constructor(params: any) {
    if (params) {
      this.trustedDevice = params?.trustedDevice;
      this.metaData = params?.metaData;
    }
  }

  async validate() {
    return await AuthSessionParamsSchema.validateAsync(this);
  }
}

export const AuthSessionParamsSchema = Joi.object<AuthSessionParams>({
  trustedDevice: Joi.boolean().required(),
  metaData: Joi.any(),
});
