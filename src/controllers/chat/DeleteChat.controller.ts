import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { Repository } from '@ubaytools/core';
import { IdParams } from '../../infrastructure';
import { Types } from 'mongoose';

@prefix('/chats')
export default class DeleteChatController {
  @request('delete', '/{chatId}')
  @summary('Delete chat')
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
      const deleted = await Repository.Chats().deleteById(new Types.ObjectId(params.id));
      return context.send.data({ deleted: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
