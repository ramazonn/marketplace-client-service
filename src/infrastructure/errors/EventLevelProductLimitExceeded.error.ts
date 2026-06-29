import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class EventLevelProductLimitExceededError extends BaseError {
  constructor() { 
    super(
      "Event level product limit exceeded!",
      {
        en: `You can only purchase one type and one unit of promotional products!`,
        ru: `Из промо-товаров можно купить только один вид и только одну единицу!`,
        uz: `Aksiyadagi mahsulotlardan faqat 1 turini va 1 dona xarid qilish mumkin!`,
      },
      ErrorCodeEnum.UNPROCESSABLE_ENTITY,
    );
  }
}