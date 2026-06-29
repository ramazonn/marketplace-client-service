import * as Joi from 'joi';
import { FeedbackTypeEnum } from '@ubaytools/core';

export class AddFeedbackParams {
  type: string;
  text: string;

  constructor(params: AddFeedbackParams) {
    this.type = params?.type;
    this.text = params?.text;
  }

  async validate() {
    return await AddFeedbackSchema.validateAsync(this);
  }
}

export const AddFeedbackSchema = Joi.object<AddFeedbackParams>({
  type: Joi.string().valid(...Object.values(FeedbackTypeEnum)),
  text: Joi.string().trim().required().max(500),
});
