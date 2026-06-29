import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams } from '../../infrastructure';
import { CloudFlareService, LanguageEnum, ModelsEntity, NotFoundError, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

class ModelDetailResponse {
  id: string;
  title: string;
  avatar: string;

  constructor(model: ModelsEntity, lang: LanguageEnum) {
    this.id = model.getId().toString();
    this.title = model.getTitle()?.getByLang(lang) ?? null;
    this.avatar = model.getAvatar() ? CloudFlareService.getImageUrlByFileID(model.getAvatar()) : null;
  }
}
@prefix('/model')
export default class GetModelDetailByIdController {
  @request('get', '/detail/{modelId}')
  @summary('Model detail')
  @security([])
  @tags(['Model'])
  @path({ modelId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.modelId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const model = await Repository.Models().getById(new Types.ObjectId(params.id));
      if (!model) {
        throw new NotFoundError('Model');
      }
      const response = new ModelDetailResponse(model, context.lang);
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
