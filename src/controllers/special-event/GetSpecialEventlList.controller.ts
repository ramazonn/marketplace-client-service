import { Context } from 'koa';
import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { ListParams } from '../../infrastructure';
import { GetActiveSpecialEventsUseCase } from '../../usecases/special-event/GetActiveSpecialEvents.usecase';

@prefix('/special-event')
export default class GetSpecialEventListController {
  @request('get', '/list')
  @summary('Get Special Event list')
  @security([])
  @tags(['Special Event'])
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
      const result = await GetActiveSpecialEventsUseCase.execute(
        params.page,
        params.size,
        context.lang,
        context?.client?.getId()?.toString() ?? null,
      );

      return context.send.data(result);
    } catch (error) {
      return context.send.error(error);
    }
  }
}