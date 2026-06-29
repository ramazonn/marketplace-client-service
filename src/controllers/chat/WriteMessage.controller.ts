import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ChatMessagesEntity, MessageTypeEnum, Repository, SenderTypeEnum } from '@ubaytools/core';
import { WriteChatMessageParams } from '../../infrastructure';
import { Types } from 'mongoose';

@prefix('/chats')
export default class WriteMessageController {
  @request('post', '/message/write')
  @summary('Write chat message')
  @security([])
  @tags(['Chats'])
  @body((WriteChatMessageParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: WriteChatMessageParams;
    try {
      params = await new WriteChatMessageParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const messageToCreate = new ChatMessagesEntity()
        .buildMessage(params.message)
        .buildMessageType(params.messageType as MessageTypeEnum)
        .buildSenderType(SenderTypeEnum.USER)
        .buildChatId(new Types.ObjectId(params.chatId))
        .buildIsRead(false);

      if (params.product) {
        messageToCreate.buildProduct(new Types.ObjectId(params.product));
      }
      const created = await Repository.ChatMessages().create(messageToCreate);
      await WriteMessageController._chatLastMessageAt(params.chatId);
      return context.send.data({ messageId: created.getId().toString() });
    } catch (error) {
      return context.send.error(error);
    }
  }

  static async _chatLastMessageAt(chatId: string) {
    try {
      const chat = await Repository.Chats().getById(new Types.ObjectId(chatId));
      chat.buildLastMessageAt(new Date());
      await Repository.Chats().update(chat);
    } catch (error) {
      console.error('Error updating chat last message at:', error);
    }
  }
}
