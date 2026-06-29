import * as KoaRouter from '@koa/router';
import { CommonControllers } from '../controllers';
import * as multer from '@koa/multer';
import { ImageUploadMiddleware } from '../middlewares';


const upload = multer();

export const CommonRouter = new KoaRouter().prefix('/common');

CommonRouter.get('/splash/list', CommonControllers.GetSplashScreenDataController);
CommonRouter.post('/upload-image', ImageUploadMiddleware(), CommonControllers.UploadImageController);
CommonRouter.get('/app-info', CommonControllers.GetAppInfoController);
CommonRouter.get('/privacy-policy', CommonControllers.GetPrivacyPolicyController);
