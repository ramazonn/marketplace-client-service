import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class PromocodeIsInvalidError extends BaseError {
  constructor() { 
    super(
      "Promocode is invalid!",
      {
        en: `Promocode is invalid!`,
        ru: `Промокод недействителен!`,
        uz: `Promocode noto'g'ri!`,
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}