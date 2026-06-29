import * as KoaRouter from '@koa/router';
import { OrderControllers } from '../controllers/order';
import { CheckClientSessionMiddleware } from '../middlewares';

export const OrderRouter = new KoaRouter().prefix('/order');

OrderRouter.get('/list', CheckClientSessionMiddleware(), OrderControllers.GetOrderListController);
OrderRouter.get('/detail/:orderId', CheckClientSessionMiddleware(), OrderControllers.OrderDetailByIdController);
OrderRouter.post('/create', CheckClientSessionMiddleware(), OrderControllers.CreateOrderController);
OrderRouter.post('/re-pay/:orderId', CheckClientSessionMiddleware(), OrderControllers.RepayOrderController);
OrderRouter.put('/update/:orderId', CheckClientSessionMiddleware(), OrderControllers.UpdateOrderController);
OrderRouter.post('/confirm/click', OrderControllers.ClickConfirmOrderController);
OrderRouter.post('/iman/calculate-purchase-options', CheckClientSessionMiddleware(), OrderControllers.ImanCalculatePurchaseOptionsController);
OrderRouter.post('/delivery-price', CheckClientSessionMiddleware(), OrderControllers.GetDeliveryPriceController);
