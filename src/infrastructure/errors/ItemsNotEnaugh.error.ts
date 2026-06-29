import {BaseError, ErrorCodeEnum} from "@ubaytools/core";

export class ItemsNotEnaughInStock extends BaseError {
  constructor() {
    super(
      "Items not found in stock!",
      {
        en: "There are not enough items in the cart in the warehouse.",
        ru: "На складе недостаточно товаров в корзине.",
        uz: "Savatdagi narsalar omborda yetarli emas."
      },
      ErrorCodeEnum.UNPROCESSABLE_ENTITY,
    );
  }
}
