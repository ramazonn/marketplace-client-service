import {BaseError, ErrorCodeEnum} from "@ubaytools/core";

export class InvalidStepError extends BaseError {
  constructor() {
    super(
      "Invalid step!",
      {
        en: "Invalid step!",
        ru: "Неверный шаг!",
        uz: "Noto'g'ri qadam!"
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}
