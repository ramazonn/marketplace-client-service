import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class UserAlreadyExistsError extends BaseError {
  constructor() {
    super(
      "User already exists error",
      {
        en: `User already exists error`,
        ru: `Ошибка Клиент уже существует`,
        uz: `Mijoz alaqachon mavjud`,
      },
      ErrorCodeEnum.CLIENT_ALREADY_EXISTS_ERROR,
    );
  }
}
