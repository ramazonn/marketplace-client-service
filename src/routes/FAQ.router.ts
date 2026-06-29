import * as KoaRouter from "@koa/router";
import {FaqControllers} from "../controllers";

export const FAQRouter = new KoaRouter().prefix('/faq');

FAQRouter.get('/list', FaqControllers.GetFAQListController);
