import * as Joi from 'joi';

export class UpdateClientPasswordParams {
  currentPassword: string;
  newPassword: string;

  constructor(params: any) {
    if (params) {
      this.currentPassword = params?.currentPassword;
      this.newPassword = params?.newPassword;
    }
  }
  async validate() {
    return await UpdateClientPasswordSchema.validateAsync(this);
  }
}

export const UpdateClientPasswordSchema = Joi.object<UpdateClientPasswordParams>({
  currentPassword: Joi.string().trim().required().regex(new RegExp('^[A-Fa-f0-9]{40}$')),
  newPassword: Joi.string().trim().required().regex(new RegExp('^[A-Fa-f0-9]{40}$')),
});
