import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ChatsEntity, Repository, StoresEntity, UserEntity } from '@ubaytools/core';
import { IdParams, ListParams } from '../../infrastructure';
import { Types } from 'mongoose';

type UserDataType = { phoneNumber: string; firstName: string; lastName: string; avatar: string };
export class ChatResponse {
  id: string;
  title: string;
  user: UserDataType;
  store: any;
  constructor(chat: ChatsEntity, user: UserEntity, store: StoresEntity) {
    this.id = chat.getId().toString();
    this.title = chat.getTitle();
    this.user = {
      phoneNumber: user.getPhoneNumber(),
      firstName: user.getUserInfo()?.getFirstname() ?? null,
      lastName: user.getUserInfo()?.getLastname() ?? null,
      avatar: user.getUserInfo()?.getAvatar() ?? null,
    };
    this.store = {
      id: store.getId().toString(),
      name: store.getName(),
      avatar: store.getAvatar(),
    };
  }
}

@prefix('/chats')
export default class GetChatDetailController {
  @request('get', '/detail/{chatId}')
  @summary('Get chat detail by id')
  @security([])
  @tags(['Chats'])
  @path({ chatId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.chatId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const chat = await Repository.Chats().getById(new Types.ObjectId(params.id));
      const user = await Repository.Users().getById(chat.getUser() as Types.ObjectId);
      const store = await Repository.Stores().getById(chat.getStore() as Types.ObjectId);
      
      const result = new ChatResponse(chat, user,store); // TODO calculate unread messages
      return context.send.data({ result });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
