import * as KoaRouter from '@koa/router';
import { ChatControllers } from '../controllers';
import { CheckClientSessionMiddleware } from '../middlewares';

export const ChatRouter = new KoaRouter().prefix('/chats');

ChatRouter.post('/create', CheckClientSessionMiddleware(), ChatControllers.CreateChatController);
ChatRouter.delete('/:chatId', CheckClientSessionMiddleware(), ChatControllers.DeleteChatController);
ChatRouter.get('/list', CheckClientSessionMiddleware(), ChatControllers.GetChatListController);
ChatRouter.get('/detail/:chatId', CheckClientSessionMiddleware(), ChatControllers.GetChatDetailController);
ChatRouter.get('/messages/:chatId', CheckClientSessionMiddleware(), ChatControllers.GetChatMessagesController);
ChatRouter.post('/message/write', CheckClientSessionMiddleware(), ChatControllers.WriteMessageController);
ChatRouter.put('/message-to-read/:messageId', CheckClientSessionMiddleware(), ChatControllers.SetMessageToReadController);
