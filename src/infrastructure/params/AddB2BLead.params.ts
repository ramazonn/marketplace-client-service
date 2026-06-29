import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class AddB2BLeadParams {
  @swaggerProperty({ type: 'string', required: true })   fullName: string;
  @swaggerProperty({ type: 'string', required: true }) phoneNumber: string;
  @swaggerProperty({ type: 'string', required: false })  companyName: string;
  @swaggerProperty({ type: 'string', required: false }) additionalInfo: string;

  constructor(params: any) {
    this.fullName = params?.fullName;
    this.phoneNumber = params?.phoneNumber;
    this.companyName = params?.companyName;
    this.additionalInfo = params?.additionalInfo;
  }

  async validate() {
    return await AddB2BLeadSchema.validateAsync(this);
  }
}

export const AddB2BLeadSchema = Joi.object<AddB2BLeadParams>({
  fullName: Joi.string().trim().required(),
  phoneNumber: Joi.string().trim().required(),
  companyName: Joi.string().trim().optional(),
  additionalInfo: Joi.string().trim().optional(),
});
