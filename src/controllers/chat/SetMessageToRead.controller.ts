import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { NotFoundError, Repository, SenderTypeEnum } from '@ubaytools/core';
import { IdParams } from '../../infrastructure';
import { Types } from 'mongoose';

@prefix('/chats')
export default class SetMessageToReadController {
  @request('put', '/message-to-read/{messageId}')
  @summary('message to read')
  @security([])
  @tags(['Chats'])
  @path({ messageId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.messageId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const message = await Repository.ChatMessages().getById(new Types.ObjectId(params.id));
      if (!message) {
        throw new NotFoundError('Message');
      }
      if (message.getSenderType() === SenderTypeEnum.MANAGER) {
        message.buildIsRead(true);
        await Repository.ChatMessages().update(message);
      }
      return context.send.data({ updated: true });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
