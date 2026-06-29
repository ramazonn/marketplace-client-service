import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ImanCalculatePurchaseOptionsParams } from '../../infrastructure';
import { ImanService } from '../../services/iman';

@prefix('/order')
export default class ImanCalculatePurchaseOptionsController {
  @request('post', '/iman/calculate-purchase-options')
  @summary('Confirm Order')
  @security([])
  @tags(['Orders'])
  @body((ImanCalculatePurchaseOptionsParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ImanCalculatePurchaseOptionsParams;
    try {
      params = await new ImanCalculatePurchaseOptionsParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const imanResponse = await ImanService.getInstance().calculatePurchaseOptions(params.totalAmount);

      return context.send.data(imanResponse);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
