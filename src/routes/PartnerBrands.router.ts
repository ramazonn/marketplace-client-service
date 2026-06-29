import * as KoaRouter from '@koa/router';
import { PartnerBrandsControllers } from '../controllers';

export const PartnerBrandsRouter = new KoaRouter().prefix('/partner-brands');

PartnerBrandsRouter.get('/list', PartnerBrandsControllers.GetPartnerBrandsListController);
PartnerBrandsRouter.get('/detail/:partnerBrandId', PartnerBrandsControllers.GetPartnerBrandDetailByIdController);

