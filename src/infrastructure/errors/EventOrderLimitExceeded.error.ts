import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class EventOrderLimitExceededError extends BaseError {
  constructor() { 
    super(
      "Event order limit exceeded!",
      {
        en: `You can only purchase one order of promotional products!`,
        ru: `Вы можете купить только один заказ промо-товаров!`,
        uz: `Aksiyadagi mahsulotlardan faqat 1 ta buyurtmani xarid qila olasiz!`,
      },
      ErrorCodeEnum.UNPROCESSABLE_ENTITY,
    );
  }
}