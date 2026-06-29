import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';
import { DeliveryAddressTypeEnum, PaymentTypeEnum } from '@ubaytools/core';

@swaggerClass()
export class CreateOrderParams {
  @swaggerProperty({ type: 'string', required: false, description: 'Manager' }) manager: string;
  @swaggerProperty({ type: 'string', required: true }) username: string;
  @swaggerProperty({ type: 'string', required: true }) phoneNumber: string;
  @swaggerProperty({ type: 'object', required: true }) address: object;
  @swaggerProperty({ type: 'string', description: Object.values(DeliveryAddressTypeEnum).join('|') }) deliveryAddressType: DeliveryAddressTypeEnum;
  @swaggerProperty({ type: 'array', items: { type: 'object', properties: { basketId: { type: 'string' } } }, required: true }) products: Array<{
    basketId: string;
  }>;
  @swaggerProperty({ type: 'number', required: true }) totalAmount: number;
  @swaggerProperty({ type: 'number', required: true }) deliveryPrice: number;
  @swaggerProperty({ type: 'string', description: Object.values(PaymentTypeEnum).join('|') }) paymentType: PaymentTypeEnum;
  @swaggerProperty({ type: 'object' }) paymentData: object; // Extend with payment gateway data when needed
  @swaggerProperty({ type: 'string', required: false }) promoCode: string;
  @swaggerProperty({ type: 'boolean', required: false }) urgentDelivery: boolean;
  @swaggerProperty({ type: 'array', items: { type: 'object', properties: { storeId: { type: 'string' } ,amount: { type: 'number' } } }, required: false }) cashbackUsage: Array<{
    storeId: string;
    amount: number;
  }>;
  @swaggerProperty({ type: 'boolean' }) needToCall: boolean;

  constructor(params: any) {
    if (params) {
      this.username = params?.username;
      this.phoneNumber = params?.phoneNumber;
      this.address = params?.address;
      this.products = params?.products;
      this.totalAmount = params?.totalAmount;
      this.paymentType = params?.paymentType;
      this.deliveryAddressType = params?.deliveryAddressType || DeliveryAddressTypeEnum.LOCATION;
      this.paymentData = params?.paymentData;
      this.manager = params?.manager;
      this.promoCode = params?.promoCode;
      this.urgentDelivery = params?.urgentDelivery;
      this.cashbackUsage = params?.cashbackUsage;
      this.deliveryPrice = params?.deliveryPrice;
      this.needToCall = params?.needToCall
    }
  }

  async validate() {
    return await CreateOrderParamsSchema.validateAsync(this);
  }
}

export const CreateOrderParamsSchema = Joi.object<CreateOrderParams>({
  username: Joi.string().trim().required(),
  manager: Joi.string().trim().optional(),
  phoneNumber: Joi.string().trim().required(),
  address: Joi.object().required(),
  deliveryAddressType: Joi.string()
    .valid(...Object.values(DeliveryAddressTypeEnum))
    .required(),
  paymentType: Joi.string().valid(
  PaymentTypeEnum.CLICK,
  PaymentTypeEnum.CLICK_QR,
  PaymentTypeEnum.CARD,
  PaymentTypeEnum.IMAN_PAY,
  PaymentTypeEnum.OTHER,
  PaymentTypeEnum.PAYME,
  PaymentTypeEnum.UZUM,),
  products: Joi.array()
    .items(Joi.object({ basketId: Joi.string().required() }))
    .required(),
  totalAmount: Joi.number().required(),
  paymentData: Joi.object(),
  promoCode: Joi.string().trim().uppercase().optional(),
  urgentDelivery: Joi.boolean().optional(),
  cashbackUsage: Joi.array()
    .items(Joi.object({ storeId: Joi.string().required(), amount: Joi.number().min(1).required() })).optional(),
  deliveryPrice: Joi.number().required(),
  needToCall: Joi.boolean().optional()
});
