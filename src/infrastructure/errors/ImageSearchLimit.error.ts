import { BaseError, ErrorCodeEnum } from '@ubaytools/core';

export class ImageSearchMinuteLimitError extends BaseError {
  constructor() {
    super(
      'Minute image search limit reached!',
      {
        en: `You can search by image 2 times per minute. Please wait and try again.`,
        ru: `Вы можете искать по изображению 2 раза в минуту. Подождите и попробуйте снова.`,
        uz: `Siz 1 daqiqada 2 ta rasm orqali qidirishingiz mumkin. Iltimos, kuting va qayta urinib ko'ring.`,
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}

export class ImageSearchDayLimitError extends BaseError {
  constructor() {
    super(
      'Daily image search limit reached!',
      {
        en: `You can search by image 5 times per day. Try again tomorrow.`,
        ru: `Вы можете искать по изображению 5 раз в день. Попробуйте завтра.`,
        uz: `Siz kuniga 5 ta rasm orqali qidirishingiz mumkin. Ertaga qayta urinib ko'ring.`,
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}

export class ImageUploadSizeLimitError extends BaseError {
  constructor() {
    super(
      'Image size limit exceeded!',
      {
        en: `Image size must not exceed ${process.env.IMAGE_UPLOAD_MAX_SIZE_MB}MB.`,
        ru: `Размер изображения не должен превышать ${process.env.IMAGE_UPLOAD_MAX_SIZE_MB} МБ.`,
        uz: `Rasm hajmi ${process.env.IMAGE_UPLOAD_MAX_SIZE_MB} MB dan oshmasligi kerak.`,
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}

export class ImageUploadMimeTypeError extends BaseError {
  constructor() {
    super(
      'Unsupported image type!',
      {
        en: 'Only JPEG, PNG and WEBP images are allowed.',
        ru: 'Разрешены только изображения JPEG, PNG и WEBP.',
        uz: 'Faqat JPEG, PNG va WEBP formatlari ruxsat etiladi.',
      },
      ErrorCodeEnum.BAD_REQUEST,
    );
  }
}
