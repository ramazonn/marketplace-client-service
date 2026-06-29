import * as KoaRouter from '@koa/router';
import { VideoContentControllers } from '../controllers';

export const VideoContentRouter = new KoaRouter().prefix('/video-contents');

VideoContentRouter.get('/list', VideoContentControllers.GetVideoContentListController);
VideoContentRouter.get('/detail/:videoContentId', VideoContentControllers.GetVideoContentDetailByIdController);
