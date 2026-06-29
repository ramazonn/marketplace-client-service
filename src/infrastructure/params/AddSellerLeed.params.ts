import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class AddSellerLeedParams {
  @swaggerProperty({ type: 'string', required: true })   fullName: string;
  @swaggerProperty({ type: 'string', required: true }) phoneNumber: string;
  @swaggerProperty({ type: 'string', required: false })  storeName: string;
  @swaggerProperty({ type: 'string', required: false }) additionalInfo: string;
  @swaggerProperty({ type: 'string', required: false }) sphera: string;

  constructor(params: any) {
    this.fullName = params?.fullName;
    this.phoneNumber = params?.phoneNumber;
    this.storeName = params?.storeName;
    this.sphera = params?.sphera;
    this.additionalInfo = params?.additionalInfo;
  }

  async validate() {
    return await AddSellerLeedSchema.validateAsync(this);
  }
}

export const AddSellerLeedSchema = Joi.object<AddSellerLeedParams>({
  fullName: Joi.string().trim().required(),
  phoneNumber: Joi.string().trim().required(),
  storeName: Joi.string().trim().optional(),
  sphera: Joi.string().trim().optional(),
  additionalInfo: Joi.string().trim().optional(),
});
