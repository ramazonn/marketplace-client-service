import { body, path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, PaymentTypeEnum, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

@prefix('/order')
export default class UpdateOrderController {
  @request('put', '/update/{orderId}')
  @summary('Update Order')
  @security([])
  @tags(['Orders'])
  @body({
    paymentType: { type: 'string', description: Object.values(PaymentTypeEnum).join('|') },
    paymentData: { type: 'object', description: 'paymentData' },
  })
  @path({ orderId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    const params: any = context.request.body;
    const orderId = new Types.ObjectId(context.params.orderId);
    try {
      const order = await Repository.Orders().getById(orderId);
      if (!order) {
        throw new NotFoundError('Order');
      }
      order.buildPaymentType(params.paymentType).buildPaymentData(params.paymentData);

      await Repository.Orders().update(order);
      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
