import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CloudFlareService, LanguageEnum, OrderEntity, OrderItemEntity, OrderStatusEnum, PromoCodeSchema, PromoCodeTypeEnum, Repository, StoreOrderEntity } from '@ubaytools/core';
import { GetProductDetailUseCase } from '../../usecases';
import { OrderListParams, ProductItemResponse } from '../../infrastructure';
import { Types } from 'mongoose';

export class OrderItemResponse {
  productId:string;
  storeId:string;
  productName:string;
  images:Array<string>;
  brand:string;
  barcode:string;
  skuCode:string;
  quantity:number;
  price:number;
  discountAmount:number;
  discountPercent:number;
  finalPrice:number;
  cashbackEarned:number;
  appliedPromoCodeAmount:number;
  hasDiscount:boolean;
  hasPromoCode: boolean;
  isPreOrder: boolean;
  
  constructor(order: OrderItemEntity, lang: LanguageEnum) {
    this.productId = order.getProductId()?.toString() ?? null;
    this.storeId = order.getStoreId()?.toString() ?? null;
    this.productName = order.getProductName()?.getByLang(lang) ?? null;
    this.images = order.getAttachments()?.map((item) => CloudFlareService.getImageUrlByFileID(item)) ?? [];
    this.brand = order.getBrand() ?? null;
    this.barcode = order.getBarcode() ?? null;
    this.skuCode = order.getSkuCode() ?? null;
    this.quantity = order.getQuantity() ?? null;
    this.price = order.getPrice() ?? null;
    this.discountAmount = order.getDiscountAmount() ?? null
    this.finalPrice = order.getFinalPrice() ?? null;
    this.cashbackEarned = order.getCashbackEarned() ?? null;
    this.appliedPromoCodeAmount = order.getAppliedPromoCodeAmount() ?? null;
    this.hasDiscount = order.getHasDiscount() ?? null;
    this.hasPromoCode = order.getHasPromoCode() ?? null;
    this.isPreOrder = order.getIsPreOrder() ?? null;
  }
}


export class OrderListItemResponse {
  id: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  discountAmount: number;
  deliveryPrice: number;
  cashbackEarned: number;
  payedFromCashback: number;
  products: Array<ProductItemResponse>;
  address: object;
  deliveryAddressType: string;
  paymentType: string;
  paymentData: Record<string,any>;
  status: OrderStatusEnum;
  createdAt: Date;
  deliveredAt: Date;
  promoCodeData: {
    code: string;
    type: PromoCodeTypeEnum;
    value: number;
    discountAmount: number;
  };
  urgentDelivery: boolean
  orderChangeLog: any[]
  storeOrders: any[]
  isPreOrder: boolean;
  isUrgentDelivery: boolean;
  fiscalRecieptUrl: string


  constructor(order: OrderEntity, lang: LanguageEnum) {
    this.id = order.getId()?.toString() ?? null;
    this.orderCode = order.getOrderCode() ?? null;
    this.totalAmount = order.getTotalAmount() ?? 0;
    this.discountAmount = order.getDiscountAmount() ?? 0;
    this.subTotal = order.getSubTotal() ?? 0;
    this.deliveryPrice = order.getDeliveryPrice() ?? 0;
    this.cashbackEarned = order.getCashbackEarned() ?? 0;
    this.payedFromCashback = order.getPayedFromCashback() ?? 0;
    this.address = order.getShippingAddress() ?? null;
    this.status = order.getStatus() ?? null;
    this.createdAt = order.getCreatedAt() ?? null;
    this.deliveredAt = order.getDeliveredAt() ?? null;
    this.deliveryAddressType = order.getDeliveryAddressType() ?? null;
    this.paymentType = order.getPaymentType() ?? null;
    this.paymentData = order.getPaymentData() ?? {};
    this.promoCodeData = order.getPromoCodeData() ? {
      code: order.getPromoCodeData()?.getCode(),
      type: order.getPromoCodeData()?.getType(),
      value: order.getPromoCodeData()?.getValue(),
      discountAmount: order.getPromoCodeData()?.getDiscountAmount()
    } : null;
    this.urgentDelivery = order.getUrgentDelivery() ?? null;
    this.isPreOrder = order.getIsPreOrder() ?? null;
    this.isUrgentDelivery = order.getUrgentDelivery() ?? null;
    this.fiscalRecieptUrl = order.getFiscalReceiptUrl() ?? null;


  }
}

@prefix('/order')
export default class OrderListController {
  @request('get', '/list')
  @summary('Order List')
  @security([])
  @tags(['Orders'])
  @query((OrderListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: OrderListParams;
    try {
      params = await new OrderListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const filter: any = {
        user: context?.client?.getId(),
      };
      if (params.status) {
        filter.status =
          params.status === 'ACTIVE'
            ? { $in: [OrderStatusEnum.PENDING, OrderStatusEnum.PROCESSING, OrderStatusEnum.SHIPPED, OrderStatusEnum.PREPARING, OrderStatusEnum.CONFIRMED, OrderStatusEnum.READY_TO_DELIVER, OrderStatusEnum.READY_TO_PICKUP, OrderStatusEnum.SHIPPED] }
            : params.status;
      }
      const count = await Repository.Orders().countDocumentsByFilter(filter);
      const orderListByUser = await Repository.Orders().list({ page: params.page, size: params.size }, filter, { createdAt: -1 });
      if (!orderListByUser.length) {
        return context.send.data({ total: count, items: [] });
      }
      const response = await Promise.all(
        orderListByUser.map(async (order) => {
          return new OrderListItemResponse(order, context.lan);
        }),
      );
      return context.send.data({ total: count, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
