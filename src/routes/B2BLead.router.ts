import * as KoaRouter from '@koa/router';
import { B2BLeadControllers } from '../controllers';

export const B2BLeadRouter = new KoaRouter().prefix('/b2b-leads');

B2BLeadRouter.post('/add', B2BLeadControllers.AddB2BLeadController);
