import OrderListController from './OrderList.controller';
import ClickConfirmOrderController from './ClickConfirmOrder.controller';
import UpdateOrderController from './UpdateOrder.controller';
import OrderDetailByIdController from './OrderDetailById.controller';
import RePayOrderController from './RePayOrder.controller';
import CreateOrderController from './CreateOrder.controller';
import ImanCalculatePurchaseOptionsController from './ImanCalculatePurchaseOptions.controller';
import GetDeliveryPriceController from './GetDeliveryPrice.controller';

export const OrderControllers = {
  CreateOrderController: CreateOrderController.controller,
  GetOrderListController: OrderListController.controller,
  OrderDetailByIdController: OrderDetailByIdController.controller,
  ClickConfirmOrderController: ClickConfirmOrderController.controller,
  UpdateOrderController: UpdateOrderController.controller,
  RepayOrderController: RePayOrderController.controller,
  ImanCalculatePurchaseOptionsController: ImanCalculatePurchaseOptionsController.controller,
  GetDeliveryPriceController: GetDeliveryPriceController.controller,
  // TODO refund, invoice, etc.
};
