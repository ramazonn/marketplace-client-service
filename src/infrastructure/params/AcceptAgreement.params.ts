import * as Joi from 'joi';

export class AcceptAgreementParams {
  /** Версия соглашения */
  version: number;

  constructor(params: any) {
    if (params) {
      this.version = params?.version;
    }
  }

  async validate() {
    return await AcceptAgreementParamsSchema.validateAsync(this);
  }
}

export const AcceptAgreementParamsSchema = Joi.object<AcceptAgreementParams>({
  version: Joi.number().required(),
});
