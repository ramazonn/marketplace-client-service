import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ChatsEntity, Repository, StoresEntity, StoresSchema } from '@ubaytools/core';
import { exist } from 'joi';
import { populate } from 'dotenv';
import { ListParams } from '../../infrastructure';

export class ChatResponse {
  id: string;
  title: string;
  user: string;
  store: any//{ id: string; name: string };
  unreadMessages: number;
  constructor(chat: ChatsEntity, unreadMessages: number) {
    this.id = chat.getId().toString();
    this.title = chat.getTitle();
    this.user = chat.getUser()?.toString();
    this.store = chat.getStore() ? {
      id: (chat.getStore() as StoresEntity).getId(),
      name: (chat.getStore() as StoresEntity).getName(),
      avatar: (chat.getStore() as StoresEntity).getAvatar()
    } : null;
    this.unreadMessages = unreadMessages;
  }
}

@prefix('/chats')
export default class GetChatListController {
  @request('get', '/list')
  @summary('Get all chats for a user')
  @security([])
  @tags(['Chats'])
  @query ((ListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ListParams;
    try {
      params = await new ListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const user = context.client;
      const chats = await Repository.Chats().list(params, { user: user.getId() }, { lastMessagesAt: -1 });
      const response = chats.map((chat) => new ChatResponse(chat, 0)); // TODO calculate unread messages
      return context.send.data({ count: chats.length, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
