import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ChatMessagesEntity, ChatsEntity, Repository, SenderTypeEnum } from '@ubaytools/core';
import { ChatMessageItemResponse, IdParams, ListParams } from '../../infrastructure';
import { Types } from 'mongoose';


@prefix('/chats')
export default class GetChatMessagesController {
  @request('get', '/messages/{chatId}')
  @summary('Create new chat')
  @security([])
  @tags(['Chats'])
  @query((ListParams as any).swaggerDocument)
  @path({ chatId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    let listParams: ListParams;
    try {
      params = await new IdParams({ id: context.params.chatId }).validate();
      listParams = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const chatMessages = await Repository.ChatMessages().list(
        { page: listParams.page, size: listParams.size },
        { chatId: new Types.ObjectId(params.id) },
        { createdAt: -1 },
      );
      
      const response = chatMessages.map((message) => new ChatMessageItemResponse(message, context.lang));
      return context.send.data({ count: chatMessages.length, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}