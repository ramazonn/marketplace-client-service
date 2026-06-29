import * as KoaRouter from '@koa/router';
import { AuthControllers } from '../controllers';
import { CheckProcessMiddleware } from '../middlewares';
import { ProcessStepEnum as Step, ProcessTypeEnum as Type } from '@ubaytools/core';

export const AuthRouter = new KoaRouter().prefix('/auth');

AuthRouter.post('/check', AuthControllers.CheckClientExistenceController);
AuthRouter.post(
  '/session',
  CheckProcessMiddleware([Type.AUTHENTICATION, Type.REGISTRATION], Step.GET_SESSION),
  AuthControllers.CreateSessionController,
);
