import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ChatsEntity, Repository } from '@ubaytools/core';
import { CreateChatParams } from '../../infrastructure';
import { Types } from 'mongoose';

@prefix('/chats')
export default class CreateChatController {
  @request('post', '/create')
  @summary('Create new chat')
  @security([])
  @tags(['Chats'])
  @body((CreateChatParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: CreateChatParams;
    try {
      params = await new CreateChatParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const user = context.client;

      const chatToCreate = new ChatsEntity()
        .buildUser(user.getId())
        .buildStore(new Types.ObjectId(params.store))
        .buildTitle(params.title)
        .buildLastMessageAt(new Date())
        .buildExtraData(params.extraData);
      const created = await Repository.Chats().create(chatToCreate);
      return context.send.data({ chatId: created.getId().toString() });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
