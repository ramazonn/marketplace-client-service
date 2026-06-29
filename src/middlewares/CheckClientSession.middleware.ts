import { Context, Next } from 'koa';
import { Middleware } from '@koa/router';
import { AuthorizationError, checkClientSessionByAccessTokenCase } from '@ubaytools/core';

export function CheckClientSessionMiddleware(): Middleware {
  return async (context: Context, next: Next): Promise<void> => {
    try {
      if (!context.headers.authorization) {
        throw new AuthorizationError('Authorization is required');
      }
      const accessToken = context.headers.authorization.split(' ')[1];
      if (!accessToken) {
        throw new AuthorizationError('AccessToken is required');
      }
      context.client = await checkClientSessionByAccessTokenCase.execute({ accessToken });
    } catch (error) {
      return context.send.error(error);
    }
    await next();
  };
}
