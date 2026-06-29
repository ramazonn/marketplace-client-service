import { BaseError, ErrorCodeEnum } from "@ubaytools/core";

export class CannotDeleteCommentError extends BaseError {
  constructor() {
    super(
      "Cannot delete comment",
      {
        en: "You can only delete your own comment",
        ru: "Вы можете удалить только свой комментарий",
        uz: "Siz faqat o‘zingiz yozgan kommentni o‘chira olasiz",
      },
      ErrorCodeEnum.AUTHORIZATION_ERROR,
    );
  }
}