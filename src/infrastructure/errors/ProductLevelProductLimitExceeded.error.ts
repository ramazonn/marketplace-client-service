import {BaseError, ErrorCodeEnum} from "@ubaytools/core";


export class ProductLevelProductLimitExceededError extends BaseError {
  constructor() {
    super(
     "Product level product limit exceeded!",
      {
        en: `You cannot purchase more than the allowed quantity of this promotional product!`,
        ru: `Вы не можете купить больше, чем разрешенное количество этого акционного товара!`,
        uz: `Aksiyadagi mahsulotni belgilangan miqdordan ko'p xarid qila olmaysiz!`,
      },
      ErrorCodeEnum.UNPROCESSABLE_ENTITY,
    );
  }
}
