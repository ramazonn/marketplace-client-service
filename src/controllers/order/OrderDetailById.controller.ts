import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CloudFlareService, LanguageEnum, NotFoundError, OrderEntity, OrderItemEntity, OrderStatusEnum, PromoCodeTypeEnum, Repository, StoreOrderEntity } from '@ubaytools/core';
import { GetProductDetailUseCase } from '../../usecases';
import {  IdParams } from '../../infrastructure';
import { Types } from 'mongoose';
import { OrderListItemResponse } from './OrderList.controller';

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
  isReviewed: boolean;
  
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
    this.isReviewed = order.getIsReviewed() ?? false;
  }
}

export class StoreOrderResponse {
  id:string;
  storeId:string;
  orderId:string;
  sellerId:string;
  storeName:string;
  storeAvatar:string;
  totalAmount:number;
  discountAmount:number;
  deliveryPrice:number;
  subTotal:number;
  cashbackEarned:number;
  payedFromCashback:number;
  userData:any;
  items:Array<OrderItemResponse>;
  promoCodeData: any;
  isPreOrder: boolean;

  
  constructor(order: StoreOrderEntity, items: OrderItemResponse[], lang: LanguageEnum) {
    this.id = order.getId()?.toString() ?? null;
    this.storeId = order.getStoreId()?.toString() ?? null;
    this.storeName = order.getStoreName() ?? null;
    this.storeAvatar = order.getStoreAvatar() ? CloudFlareService.getImageUrlByFileID(order.getStoreAvatar()) : null;
    this.totalAmount = order.getTotalAmount() ?? null;
    this.discountAmount = order.getDiscountAmount() ?? null;
    this.deliveryPrice = order.getDeliveryPrice() ?? null;
    this.subTotal = order.getSubTotal() ?? null;
    this.cashbackEarned = order.getCashbackEarned() ?? null
    this.payedFromCashback = order.getPayedFromCashback() ?? null
    this.userData = order.getUserData()?.convertToSchema() ?? null;
    this.items = items ?? null;
    this.promoCodeData = order.getPromoCodeData() ?? null;
    this.isPreOrder = order.getIsPreOrder() ?? null;

  }
}

export class OrderDetailResponse {
  id: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  discountAmount: number;
  deliveryPrice: number;
  cashbackEarned: number;
  payedFromCashback: number;
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
  fiscalRecieptUrl: string


  constructor(order: OrderEntity, storeOrders: StoreOrderResponse[], orderChangeLogs:any[], lang: LanguageEnum) {
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
    this.orderChangeLog = orderChangeLogs ?? [];
    this.storeOrders = storeOrders ?? [];
    this.isPreOrder = order.getIsPreOrder() ?? null;
    this.fiscalRecieptUrl = order.getFiscalReceiptUrl() ?? null;


  }
}

@prefix('/order')
export default class OrderDetailByIdController {
  @request('get', '/detail/{orderId}')
  @summary('Order detail by id')
  @security([])
  @tags(['Orders'])
  @path({ orderId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.orderId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const found = await Repository.Orders().getById(new Types.ObjectId(params.id));
      if (!found) {
        throw new NotFoundError('Order');
      }
      const orderChangeLogs = await Repository.OrderChangeLogs().findByOrder(new Types.ObjectId(params.id))
      const formattedOrderChangeLogs = orderChangeLogs.map(change => {
        return {
          date: change.getCreatedAt(),
          updatedBy: change.getAdminData(),
          changes: change.getChanges()
        }
      });
      
      const storeOrders = await Repository.StoreOrders().list({}, { orderId: new Types.ObjectId(params.id) }, {} );
      const storeOrdersResponse = storeOrders.map(order => {
        const items = order.getItems().map(item => new OrderItemResponse(item, context.lang));
        return new StoreOrderResponse(order, items, context.lang);
      })
      const response = new OrderDetailResponse(found,  storeOrdersResponse, formattedOrderChangeLogs, context.lang);
      
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
