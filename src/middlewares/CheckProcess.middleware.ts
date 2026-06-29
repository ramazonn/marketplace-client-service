import { Context, Next } from 'koa';
import { checkProcessStepCase, ProcessStepEnum, ProcessTypeEnum } from '@ubaytools/core';
import { Middleware } from '@koa/router';

export function CheckProcessMiddleware(processTypes: ProcessTypeEnum[], step: ProcessStepEnum): Middleware {
  return async (context: Context, next: Next): Promise<void> => {
    try {
      context.process = await checkProcessStepCase.execute({
        token: context.headers['token'] as string,
        deviceUId: context.headers['device-uid'] as string,
        processTypes: processTypes,
        step: step,
      });
    } catch (error) {
      return context.send.error(error);
    }
    await next();
  };
}
