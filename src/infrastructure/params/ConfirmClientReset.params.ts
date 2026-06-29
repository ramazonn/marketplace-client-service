import * as Joi from 'joi';

export class ConfirmClientResetParams {
  /** Подтверждение сброса аккаунта */
  confirm: boolean;

  constructor(params: any) {
    if (params) {
      this.confirm = params?.confirm;
    }
  }

  async validate() {
    return await ConfirmClientResetParamsSchema.validateAsync(this);
  }
}

export const ConfirmClientResetParamsSchema = Joi.object<ConfirmClientResetParams>({
  confirm: Joi.boolean().required(),
});
