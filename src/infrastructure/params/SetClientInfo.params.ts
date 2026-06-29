import * as Joi from 'joi';
import { GenderEnum } from '@ubaytools/core';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class SetClientInfoParams {
  /** Имя */
  @swaggerProperty({ type: 'string' }) firstName: string;

  /** Фамилия */
  @swaggerProperty({ type: 'string' }) lastName: string;
  @swaggerProperty({ type: 'string' }) middleName: string;

  /** Дата рождения */
  @swaggerProperty({ type: 'string' }) birthDate: string;
  @swaggerProperty({ type: 'string' }) email: string;
  @swaggerProperty({ type: 'boolean' }) enableNotification: boolean;

  @swaggerProperty({ type: 'string' }) gender: GenderEnum;

  constructor(params: any) {
    if (params) {
      this.firstName = params?.firstName;
      this.lastName = params?.lastName;
      this.middleName = params?.middleName;
      this.birthDate = params?.birthDate;
      this.gender = params?.gender;
      this.email = params?.email;
      this.enableNotification = params?.enableNotification;
    }
  }

  async validate() {
    return await SetClientInfoParamsSchema.validateAsync(this);
  }
}

export const SetClientInfoParamsSchema = Joi.object<SetClientInfoParams>({
  firstName: Joi.string().trim().allow(null, ''),
  lastName: Joi.string().trim().allow(null, ''),
  middleName: Joi.string().trim().allow(null, ''),
  birthDate: Joi.string().optional(),
  email: Joi.string().email().optional(),
  enableNotification: Joi.boolean().strict().optional(),
  gender: Joi.string().valid(...Object.values(GenderEnum)).optional(),
});
