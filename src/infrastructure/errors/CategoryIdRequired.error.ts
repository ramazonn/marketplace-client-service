import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class CategoryIdRequiredError extends BaseError {
  constructor() {
    super(
      "Category ID is required!",
      {
        en: `Category ID is required!`,
        ru: `ID категории обязательно!`,
        uz: `Kategoriya ID si majburiy!`,
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}
