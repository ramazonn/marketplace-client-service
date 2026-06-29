import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { GetSingleCarouselUseCase } from '../../usecases/carousel/GetSingleCarousel.usecase';
import { CarouselListItemResponse } from './GetCarouselList.controller';

@prefix('/carousel')
export default class GetSingleCarouselController {
  @request('get', '/single/{carouselId}')
  @summary('Get single carousel')
  @security([])
  @tags(['Carousel'])
  @query({ carouselId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    const { carouselId } = context.request.query as any;
    try {
      const result = await GetSingleCarouselUseCase.execute(
        carouselId,
        context.lang,
        context?.client?.getId() ?? null,
      );

      const response = new CarouselListItemResponse(result.carousel, result.products, context.lang);

      return context.send.data({ response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
