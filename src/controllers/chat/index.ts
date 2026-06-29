import CreateChatController from './CreateChat.controller';
import DeleteChatController from './DeleteChat.controller';
import GetChatListController from './GetChatList.controller';
import GetChatMessagesController from './GetChatMessages.controller';
import WriteMessageController from './WriteMessage.controller';
import SetMessageToReadController from './SetMessageToRead.controller';
import GetChatDetailController from './GetChatDetail.controller';

export const ChatControllers = {
  CreateChatController: CreateChatController.controller,
  DeleteChatController: DeleteChatController.controller,
  GetChatListController: GetChatListController.controller,
  GetChatMessagesController: GetChatMessagesController.controller,
  SetMessageToReadController: SetMessageToReadController.controller,
  WriteMessageController: WriteMessageController.controller,
  GetChatDetailController: GetChatDetailController.controller,
};
