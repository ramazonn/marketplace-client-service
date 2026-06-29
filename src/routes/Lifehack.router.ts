import * as KoaRouter from '@koa/router';
import { LifehackControllers } from '../controllers';
import { CheckClientSessionMiddleware, CheckOptionalSessionMiddleware } from '../middlewares';

export const LifehackRouter = new KoaRouter().prefix('/lifehacks');

LifehackRouter.get('/list', CheckOptionalSessionMiddleware(), LifehackControllers.GetLifehackListController);
LifehackRouter.get('/detail/:lifehackId', CheckOptionalSessionMiddleware(), LifehackControllers.GetLifehackDetailByIdController);

// comments
LifehackRouter.get('/comments-list/:lifehackId', CheckOptionalSessionMiddleware(), LifehackControllers.GetLifehackCommentsListController);
LifehackRouter.get('/comment-replies-list/:commentId', CheckOptionalSessionMiddleware(), LifehackControllers.GetLifehackCommentRepliesController);
LifehackRouter.post('/comments-create/:lifehackId', CheckClientSessionMiddleware(), LifehackControllers.AddLifehackCommentController);
LifehackRouter.delete('/comments-delete/:commentId', CheckClientSessionMiddleware(), LifehackControllers.DeleteLifehackCommentController);

// likes
LifehackRouter.get('/likes-list/:lifehackId', CheckClientSessionMiddleware(), LifehackControllers.GetLifehackLikesListController);
LifehackRouter.post('/likes-toggle/:lifehackId', CheckClientSessionMiddleware(), LifehackControllers.AddLifehackLikeController);
