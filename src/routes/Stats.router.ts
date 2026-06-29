import * as KoaRouter from '@koa/router';
import { StatsControllers } from '../controllers';

export const StatsRouter = new KoaRouter().prefix('/stats');

StatsRouter.get('/main', StatsControllers.GetMainStatsController);