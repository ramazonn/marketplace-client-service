import * as KoaRouter from '@koa/router';
import { NotificationControllers } from '../controllers/notification';
import { CheckClientSessionMiddleware } from '../middlewares';

export const NotificationRouter = new KoaRouter().prefix('/notifications');

NotificationRouter.get('/list', CheckClientSessionMiddleware(), NotificationControllers.GetNotificationListController);
NotificationRouter.get('/detail/:id', CheckClientSessionMiddleware(), NotificationControllers.GetNotificationDetailController);
NotificationRouter.get('/unread', CheckClientSessionMiddleware(), NotificationControllers.GetUnReadNotificationListController);
