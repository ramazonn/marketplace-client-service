import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ListParams, ProductItemResponse, ProductBasicDetailResponse } from '../../infrastructure';
import { CarouselEntity, CarouselStatusEnum, LanguageEnum } from '@ubaytools/core';
import { GetCarouselListUseCase } from '../../usecases/carousel/GetCarouselList.usecase';

export class CarouselListItemResponse {
  id: string;
  title: string;
  status: CarouselStatusEnum;
  products: Array<ProductBasicDetailResponse>;
  productsCount: number;
  constructor(carousel: CarouselEntity, products: Array<ProductBasicDetailResponse>, lang: LanguageEnum) {
    this.id = carousel.getId().toString();
    this.title = carousel.getTitle()?.getByLang(lang) ?? null;
    this.status = carousel.getStatus() ?? null;
    this.products = products ?? [];
    this.productsCount = products.length;
  }
}

@prefix('/carousel')
export default class GetCarouselListController {
  @request('get', '/list')
  @summary('Carousel list')
  @security([])
  @tags(['Carousel'])
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
      const result = await GetCarouselListUseCase.execute(
        params.page,
        params.size,
        context.lang,
        context?.client?.getId() ?? null,
      );

      const response = result.items.map((item) => new CarouselListItemResponse(item.carousel, item.products, context.lang));

      return context.send.data({ total: result.total, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
