import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { UserReviewListParams } from '../../infrastructure';
import { BrandsEntity, CloudFlareService, LanguageEnum, ProductEntity, Repository, ReviewsEntity } from '@ubaytools/core';
import { Promise } from 'mongoose';

class UserReviewListItemResponse {
  id: string;
  description: string;
  advantages: string;
  disadvantages: string;
  stars: number;
  createdAt: Date;
  product: any;
  answer: string;
  attachments: string[];
  constructor(review: ReviewsEntity, lang: LanguageEnum) {
    const product = review.getProduct() as ProductEntity
    this.id = review.getId().toString();
    this.product = {
      id: product.getId(),
      name: product.getName().getByLang(lang)??'',
      brand: (product.getProductInfo()?.getBrand() as BrandsEntity)?.getTitle()?.getByLang(lang)??'',
      attachments: product.getAttachments()?.map((item) => CloudFlareService.getImageUrlByFileID(item)) ?? []
    } ;
    this.stars = review.getStars() ?? null;
    this.advantages = review.getAdvantages() ?? null;
    this.disadvantages = review.getDisadvantages() ?? null;
    this.description = review.getDescription() ?? null;
    this.attachments = review.getAttachments()?.map((item) => CloudFlareService.getImageUrlByFileID(item)) ?? [];
    this.answer = review.getAnswer() ?? null;
    this.createdAt = review.getCreatedAt() ?? null;

  }
}

@prefix('/review')
export default class GetUserReviewsController {
  @request('get', '/by-user')
  @summary('User reviews')
  @security([])
  @tags(['Review'])
  @query((UserReviewListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: UserReviewListParams;
    try {
      params = await new UserReviewListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const filter = {};
      filter['user'] = context?.client?.getId()?.toHexString();
      const count = await Repository.Reviews().countDocumentsByFilter(filter);
      const items = await Repository.Reviews().list({ page: params.page, size: params.size }, filter, { createdAt: -1 });
      const response = await Promise.all(
        items.map(async (item) => {
          // const product = await GetProductDetailUseCase.execute(
          //   (item.getProduct() as ProductEntity).getId().toHexString(),
          //   context.lang,
          //   context?.client?.getId()?.toHexString(),
          // );
          return new UserReviewListItemResponse(item, context.lang);
        }),
      );
      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
