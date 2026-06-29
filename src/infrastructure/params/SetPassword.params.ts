import * as Joi from 'joi';

export class SetPasswordParams {
  password: string;

  constructor(params: any) {
    if (params) {
      this.password = params?.password;
    }
  }

  async validate() {
    return await SetPasswordParamsSchema.validateAsync(this);
  }
}

export const SetPasswordParamsSchema = Joi.object<SetPasswordParams>({
  password: Joi.string().trim().required(),
});
