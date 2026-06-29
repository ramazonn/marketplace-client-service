import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams } from '../../infrastructure';
import { CloudFlareService, FaqEntity, FaqStatusEnum, LanguageEnum, Repository } from '@ubaytools/core';

export class FaqListItemResponse {
  id: string;
  title: string;
  description: string;
  attachments: Array<string>;
  type: string;
  constructor(faq: FaqEntity, lang: LanguageEnum) {
    this.id = faq.getId().toString();
    this.title = faq.getTitle().getByLang(lang);
    this.description = faq.getDescription().getByLang(lang);
    this.attachments = faq.getAttachments() ? faq.getAttachments().map((fileId) => CloudFlareService.getImageUrlByFileID(fileId)) : [];
    this.type = faq.getType();
  }
}

@prefix('/FAQ')
export default class GetFAQListController {
  @request('get', '/list')
  @summary('FAQ list')
  @security([])
  @tags(['FAQ'])
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
      const countFaqs = await Repository.Faqs().countDocumentsByFilter({ status: FaqStatusEnum.ACTIVE });
      const faqs = await Repository.Faqs().list({ page: params.page, size: params.size }, { status: FaqStatusEnum.ACTIVE });
      const response = faqs.map((faq) => new FaqListItemResponse(faq, context.lang));
      return context.send.data({ total: countFaqs, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
