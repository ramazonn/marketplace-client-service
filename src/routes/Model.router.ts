import * as KoaRouter from '@koa/router';
import { ModelControllers } from '../controllers';

export const ModelRouter = new KoaRouter().prefix('/model');

ModelRouter.get('/list', ModelControllers.GetModelListController);
ModelRouter.get('/detail/:modelId', ModelControllers.GetModelDetailByIdController);
