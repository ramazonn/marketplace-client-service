import * as KoaRouter from '@koa/router';
import { ConfirmationControllers } from '../controllers';
import { CheckProcessMiddleware } from '../middlewares';
import { ProcessStepEnum, ProcessTypeEnum } from '@ubaytools/core';

const allowedProcesses = [
  ProcessTypeEnum.REGISTRATION,
  ProcessTypeEnum.AUTHENTICATION,
  ProcessTypeEnum.RESET_ACCOUNT,
  ProcessTypeEnum.RESET_PASSWORD,
];

export const ConfirmationRouter = new KoaRouter().prefix('/confirmation');

ConfirmationRouter.post(
  '/validate',
  CheckProcessMiddleware(allowedProcesses, ProcessStepEnum.CONFIRMATION),
  ConfirmationControllers.ValidateController,
);

ConfirmationRouter.post('/resend', CheckProcessMiddleware(allowedProcesses, ProcessStepEnum.CONFIRMATION), ConfirmationControllers.ReSendController);
