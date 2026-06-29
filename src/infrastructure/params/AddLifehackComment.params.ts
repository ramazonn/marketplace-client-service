import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class AddLifehackCommentParams {
  @swaggerProperty({ type: 'string', required: true })
  text: string;

  constructor(params: any) {
    this.text = params?.text;
  }

  async validate() {
    return await AddLifehackCommentParamsSchema.validateAsync(this);
  }
}

export const AddLifehackCommentParamsSchema = Joi.object<AddLifehackCommentParams>({
  text: Joi.string().trim().min(1).required(),
});