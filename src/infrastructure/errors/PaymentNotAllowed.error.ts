import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class PaymentNotAllowedError extends BaseError {
  constructor() { 
    super(
      "Payment not allowed, order status is not PENDING!",
      {
        en: `Payment not allowed, order status is not PENDING!`,
        ru: `Оплата не разрешена, статус заказа не PENDING!`,
        uz: `To'lov amal qilmasligi mumkin, buyurtma holati KUTILMOQDA emas!`,
      },
      ErrorCodeEnum.UNPROCESSABLE_ENTITY,
    );
  }
}