import { Context, Next } from 'koa';
import { Middleware } from '@koa/router';
import * as multer from '@koa/multer';
import { ImageUploadMimeTypeError, ImageUploadSizeLimitError } from '../infrastructure';

const upload = multer({
  limits: {
    fileSize: parseInt(process.env.IMAGE_UPLOAD_MAX_SIZE_MB) * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new ImageUploadMimeTypeError(), false);
    }

    cb(null, true);
  },
});

export function ImageUploadMiddleware(): Middleware {
  return async (context: Context, next: Next): Promise<void> => {
    try {
      await upload.single('file')(context, async () => {});

      await next();
    } catch (error: any) {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return context.send.error(new ImageUploadSizeLimitError());
      }

      return context.send.error(error);
    }
  };
}
