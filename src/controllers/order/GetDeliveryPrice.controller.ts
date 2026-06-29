import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CalculateDeliveryPriceParams } from '../../infrastructure';
import { CalculateTotalAmountUseCase, FindDeliveryRuleByAmountUseCase } from '../../usecases';
import { EventTypeEnum, PaymentTypeEnum } from '@ubaytools/core';
import { EventQueueService } from '../../services';

@prefix('/order')
export default class GetDeliveryPriceController {
  @request('post', '/delivery-price')
  @summary('Calculate delivery price by basket total')
  @security([])
  @tags(['Orders'])
  @body((CalculateDeliveryPriceParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: CalculateDeliveryPriceParams;
    try {
      params = await new CalculateDeliveryPriceParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const { totalAmount, subTotal, discountAmount, product, promoDiscountAmount } = await CalculateTotalAmountUseCase.execute({
        products: params.products,
        promoCode: params.promoCode,
        userId:context.client.getId()
      });
      let matchedRule = { ruleId: null, note: null, deliveryPrice: 0 };
      if (params.paymentType !== PaymentTypeEnum.IMAN_PAY) {
        matchedRule = await FindDeliveryRuleByAmountUseCase.execute(totalAmount);
      }

      const response = {
        totalAmount,
        subTotal,
        discountAmount,
        promoDiscountAmount,
        // delivery price added on top of product's price 
        deliveryPrice: 0,//matchedRule.deliveryPrice,
        ruleId: matchedRule.ruleId,
        note: matchedRule.note,
      };
      void EventQueueService.getInstance().publishToQueue({
        userId: context.client.getId().toString(),
        eventType: EventTypeEnum.BEGIN_CHECKOUT,
        timestamp: new Date(),
        metadata: {
          product,
          price: totalAmount
        },
      });
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
