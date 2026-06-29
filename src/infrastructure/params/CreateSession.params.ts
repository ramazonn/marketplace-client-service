import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class DeviceMetadataRequestParams {
  @swaggerProperty({ type: 'string' }) osName: string;
  @swaggerProperty({ type: 'string' }) osVersion: string;
  @swaggerProperty({ type: 'string' }) osSdkVersion: string;
  @swaggerProperty({ type: 'string' }) model: string;
  @swaggerProperty({ type: 'string' }) vendor: string;
  @swaggerProperty({ type: 'string' }) architecture: string;
  @swaggerProperty({ type: 'string' }) dpi: string;
}

@swaggerClass()
export class CreateSessionParams {
  /** Номер телефона */
  @swaggerProperty({ type: 'boolean', required: false, description: 'if PIN-code is set, trustedDevice is true otherwise false' })
  trustedDevice: boolean;
  @swaggerProperty({ type: 'object', properties: (DeviceMetadataRequestParams as any).swaggerDocument, required: false })
  metadata: DeviceMetadataRequestParams;
  @swaggerProperty({ type: 'string', required: false }) fcmToken?: string;

  constructor(params: any) {
    if (params) {
      this.trustedDevice = params?.trustedDevice;
      this.metadata = params?.metadata;
      this.fcmToken = params?.fcmToken;
    }
  }

  async validate() {
    return await CreateSessionParamsSchema.validateAsync(this);
  }
}

export const CreateSessionParamsSchema = Joi.object<CreateSessionParams>({
  trustedDevice: Joi.boolean().default(false),
  fcmToken: Joi.string().allow('').optional(),
  metadata: Joi.object({
    osName: Joi.string().optional(),
    osVersion: Joi.string().optional(),
    osSdkVersion: Joi.string().allow('').optional(),
    model: Joi.string().optional(),
    vendor: Joi.string().optional(),
    architecture: Joi.string().allow('').optional(),
    dpi: Joi.string().allow('').optional(),
  })
    .allow(null)
    .optional(),
});
