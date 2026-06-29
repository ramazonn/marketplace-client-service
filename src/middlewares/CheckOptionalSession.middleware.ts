import { Context, Next } from 'koa';
import { Middleware } from '@koa/router';
import { checkClientSessionByAccessTokenCase } from '@ubaytools/core';

export function CheckOptionalSessionMiddleware(): Middleware {
  return async (context: Context, next: Next): Promise<void> => {
    try {
      if (context.headers.authorization) {
        const accessToken = context.headers.authorization.split(' ')[1];
        if (accessToken) {
          context.client = await checkClientSessionByAccessTokenCase.execute({ accessToken });
        }
      }
    } catch (error) {
      console.error(error);
      context.client = null;
    }
    await next();
  };
}
