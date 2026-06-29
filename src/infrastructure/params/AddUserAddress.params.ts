import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class AddUserAddressParams {
  @swaggerProperty({ type: 'string', required: true }) address: string;
  @swaggerProperty({ type: 'number', required: true }) latitude: number;
  @swaggerProperty({ type: 'number', required: true }) longitude: number;


  constructor(params: any) {
    this.address = params?.address;
    this.latitude = params?.latitude;
    this.longitude = params?.longitude;
  }

  async validate() {
    return await AddUserAddressSchema.validateAsync(this);
  }
}

export const AddUserAddressSchema = Joi.object<AddUserAddressParams>({
  address: Joi.string().trim().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
});
