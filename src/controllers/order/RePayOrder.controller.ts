import { body, path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { PaymentNotAllowedError } from '../../infrastructure';
import {
  NotFoundError,
  OrderStatusEnum,
  PaymentLogEntity,
  PaymentLogTypeEnum,
  PaymentTypeEnum,
  Repository,
} from '@ubaytools/core';
import { Types } from 'mongoose';
import { OctoPaymentStatus, OctoService } from '../../services';
import { ImanService } from '../../services/iman';

@prefix('/order')
export default class RePayOrderController {
  @request('post', '/re-pay/{orderId}')
  @summary('Create Order')
  @security([])
  @tags(['Orders'])
  // @params({orderIdL{type:'string'}})
  @path({ orderId: { type: 'string', required: true } })
  @body({ paymentType: { type: 'string', enum: Object.values(PaymentTypeEnum) }, totalAmounts: { type: 'number', required: true } })
  static async controller(context: Context): Promise<void> {
    const orderId = context.params.orderId;
    const { paymentType, totalAmounts } = context.request.body as any;
    try {
      const order = await Repository.Orders().getById(new Types.ObjectId(orderId));
      if (!order) throw new NotFoundError('Order');
      if (order.getStatus() !== OrderStatusEnum.PENDING) throw new PaymentNotAllowedError();

      const currentPaymentType = order.getPaymentType();
      const paymentData = order.getPaymentData();
      const totalAmount = order.getTotalAmount();
      const response: any = { id: orderId };

      let shouldCreateNewPayment = true;
      /*
       * UPDATED: Eski paymentni faqat type bir xil + amount bir xil bo'lsa qaytaramiz
       */
      const isSameAmount = paymentData?.amount === totalAmount;

      if (currentPaymentType === paymentType && paymentData?.url && isSameAmount) {
        response['payment'] = paymentData;
        shouldCreateNewPayment = false;
      }

      /*
       * Yangi payment kerak bo‘lsa
       */
      if (shouldCreateNewPayment) {
        /*
         * CLICK UCHUN
         */
        if (paymentType === PaymentTypeEnum.CLICK) {
          const url = `${process.env.CLICK_URL}?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${totalAmount}&transaction_param=${order.getOrderCode()}&return_url=${process.env.CLICK_RETURN_URL}`;
          response['payment'] = { url, error: null, amount: totalAmount };
        }

        /*
         * CARD UCHUN
         */
        if (paymentType === PaymentTypeEnum.CARD) {
          try {
            const octoService = new OctoService({
              orderCode: order.getOrderCode().toString(),
              totalAmount: totalAmount,
              user: { id: context.client.getId().toString(), phoneNumber: context.client.getPhoneNumber(), lang: context.lang.toLowerCase() || 'ru' },
            });
            const payData = await octoService.preparePayment();
            const paymentLog = new PaymentLogEntity()
              .buildMerchantTransId(order.getOrderCode())
              .buildLogData(payData)
              .buildPaymentType(PaymentTypeEnum.CARD)
              .buildType(PaymentLogTypeEnum.PREPARE);
            await Repository.PaymentLog().create(paymentLog);
            if (payData && payData?.data?.status == OctoPaymentStatus.CREATED) {
              response['payment'] = { url: payData?.data?.octo_pay_url, error: null, amount: totalAmount };
            } else if (payData && payData.error) {
              console.error('Error in octo payment', payData.error);
              response['payment'] = { error: payData.error, url: null, amount: totalAmount };
            }
          } catch (error) {
            console.error('Error in octo payment', error);
            response['payment'] = { error: 'Payment error', url: null };
          }
        }
        /**
         * IMAN PAY UCHUN
         */
        if (paymentType === PaymentTypeEnum.IMAN_PAY) {
          try{
            const iman = await ImanService.getInstance().createBasket(order);
            response['payment'] = { ...iman.data.reference, url: iman.data.reference.deep_link, error: null, amount: totalAmount};
            const paymentLog = new PaymentLogEntity()
              .buildMerchantTransId(order.getOrderCode())
              .buildPaymentType(PaymentTypeEnum.IMAN_PAY)
              .buildLogData(iman.data)
              .buildType(PaymentLogTypeEnum.PREPARE);
            await Repository.PaymentLog().create(paymentLog);
          } catch (error) {
            console.error('Error in iman payment', error.response.data.errors);
            response['payment'] = { error: 'Payment error', url: null, amount: totalAmount };
          };
        }

        if (paymentType === PaymentTypeEnum.PAYME) {
          const paymeId = process.env.PAYME_ID;
          const orderCode = order.getOrderCode().toString();

          const amount = totalAmount * 100;

          const returnUrl = process.env.PAYME_RETURN_URL;

          const encoded = Buffer.from(`m=${paymeId};ac.order_id=${orderCode};a=${amount};c=${returnUrl}`).toString('base64');

          const paymentUrl =`${process.env.PAYME_URL}/${encoded}`;

          response['payment'] = {
            url: paymentUrl,
            error: null,
            amount: totalAmount,
          };
        }

        if (paymentType === PaymentTypeEnum.UZUM) {

          const serviceId = process.env.UZUM_SERVICE_ID;

          const orderCode = order.getOrderCode().toString();

          const amount = totalAmount * 100;

          const paymentUrl = `${process.env.UZUM_API_URL}/open-service?serviceId=${serviceId}&orderId=${orderCode}&amount=${amount}`;

          response['payment'] = {
            url: paymentUrl,
            error: null,
            amount: totalAmount,
          };
        }
        order.buildPaymentType(paymentType).buildPaymentData(response['payment']);
        await Repository.Orders().update(order);


      }

      return context.send.data(response);

    } catch (error) {
      return context.send.error(error);
    }
  }
}