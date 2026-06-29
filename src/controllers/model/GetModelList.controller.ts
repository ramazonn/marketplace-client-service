import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams } from '../../infrastructure';
import { CloudFlareService, LanguageEnum, ModelsEntity, Repository } from '@ubaytools/core';

class ModelListItemResponse {
  id: string;
  title: string;
  description: string;
  avatar: string;
  constructor(model: ModelsEntity, lang: LanguageEnum) {
    this.id = model.getId().toString();
    this.title = model.getTitle()?.getByLang(lang) ?? null;
    this.description = model.getDesc()?.getByLang(lang) ?? null;
    this.avatar = model.getAvatar() ? CloudFlareService.getImageUrlByFileID(model.getAvatar()) : null;
  }
}
@prefix('/model')
export default class GetModelListController {
  @request('get', '/list')
  @summary('Model list')
  @security([])
  @tags(['Model'])
  @query((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;
    try {
      params = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const count = await Repository.Models().countDocumentsByFilter({});
      const items = await Repository.Models().list({ page: params.page, size: params.size });
      const response = items.map((item) => new ModelListItemResponse(item, context.lang));
      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
