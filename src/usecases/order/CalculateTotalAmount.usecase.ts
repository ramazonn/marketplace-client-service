import { Types } from 'mongoose';
import {
  OrderItemEntity,
  ProductEntity,
  PromoCodeTypeEnum,
  Repository,
  SpecialEventEntity,
  SpecialEventStatusEnum,
  StoreCashbackTypeEnum,
  StoreOrderEntity,
  PromoCodeOwnerTypeEnum,
  TranslatesSchema,
} from '@ubaytools/core';
import { ItemsNotEnaughInStock } from '../../infrastructure';

export interface CalculateTotalAmountParams {
  products: Array<{ basketId: string }>;
  promoCode?: string;
  userId?: Types.ObjectId
}

export interface CalculateTotalAmountResult {
  totalAmount: number;
  subTotal: number;
  discountAmount: number;
  product?: Types.ObjectId;
  promoDiscountAmount: number;

  promoCode?: {
    id: Types.ObjectId;
    code: string;
    value: number;
    type: PromoCodeTypeEnum;
  };
}

/**
 * Calculates order total amount from basket items, applying cashback usage and promo code.
 * Copy of the calculation logic from CreateOrder — no side effects (no order/basket/cashback updates).
 */
export class CalculateTotalAmountUseCase {
  static async execute(params: CalculateTotalAmountParams): Promise<CalculateTotalAmountResult> {
    let totalAmount = 0;
    let discountAmount = 0;
    let subTotal = 0;
    let productId: Types.ObjectId | undefined;

    let allItemExist = true;
    const storeOrdersMap = new Map<string, StoreOrderEntity>();
    const dummyOrderId = new Types.ObjectId();

    let promoCode: {
      id: string;
      type: PromoCodeTypeEnum;
      description: TranslatesSchema;
      value: number;
      ownerType: PromoCodeOwnerTypeEnum;
      store?: Types.ObjectId;
    } = null;

    if (params.promoCode) {
      const checkPromocodeResult = await Repository.PromoCodes().checkPromoCode(params.promoCode, params.userId);
      promoCode = checkPromocodeResult.promocode
    }

    let promoDiscountAmount = 0;

    const basketModifiedData = await Promise.all(
      params.products.map(async (item) => {
        const basketProduct = await Repository.UserLikedProducts().getById(new Types.ObjectId(item.basketId));
        if (!basketProduct) return null;

        const product = basketProduct.getProduct() as ProductEntity;
        const isItemPreOrder = product.getIsPreOrder() ?? false;
        if (!isItemPreOrder && product.getCount() < basketProduct.getCountInBasked()) {
          allItemExist = false;
          return null;
        }

        const specialEvent = basketProduct.getSpecialEvent() as SpecialEventEntity;
        const specialEventProduct = await Repository.SpecialEventProducts().findByProductAndSpecialEvent(product.getId(), specialEvent?.getId());
        const limitForSale = specialEventProduct?.getLimitForSale();
        const soldCount = (specialEventProduct?.getSoldCount() ?? 0) + basketProduct.getCountInBasked();
        if (specialEvent && specialEvent.getStatus() === SpecialEventStatusEnum.ACTIVE && soldCount > limitForSale) {
          allItemExist = false;
          return null;
        }

        productId = product.getId();
        let price = product.getProductInfo().getCurrentPrice();
        let discountPrice = product.getProductInfo().getDiscountPrice() ?? 0;
        let discountPercent = product.getProductInfo().getDiscountPercent() ?? 0;
        if (specialEvent && specialEvent.getStatus() === SpecialEventStatusEnum.ACTIVE && specialEventProduct?.getIsActive()) {
          discountPrice = specialEventProduct.getDiscountPrice();
          discountPercent = specialEventProduct.getDiscountPercent();
        }

        let appliedDiscount = 0;
        const isDiscounted = discountPrice > 0;
        if (isDiscounted) appliedDiscount = price - discountPrice;
        let finalPrice = price - appliedDiscount;

        const store = await Repository.Stores().getById(product.getStore() as Types.ObjectId);

        if (promoCode &&
          promoCode.ownerType === PromoCodeOwnerTypeEnum.STORE &&
          promoCode.store?.toString() === store.getId().toString() &&
          promoCode.type === PromoCodeTypeEnum.PERCENTAGE
        ) {

          const itemPromoDiscount = (finalPrice * promoCode.value) / 100;
          finalPrice -= itemPromoDiscount;
          promoDiscountAmount += itemPromoDiscount * basketProduct.getCountInBasked();
        }

        const quantity = basketProduct.getCountInBasked();
        const itemDiscountAmount = appliedDiscount * quantity;
        const itemTotalAmount = finalPrice * quantity;
        const itemSubTotal = price * quantity;
        totalAmount += itemTotalAmount;
        subTotal += itemSubTotal;
        discountAmount += itemDiscountAmount;

        const storeCashbackConfig = store.getCashbackConfig();
        let cashbackAmount = 0;
        let cashbackPercent = 0;
        const cashbackType = storeCashbackConfig.getEnabled() ? storeCashbackConfig.getType() : null;
        if (storeCashbackConfig.getEnabled()) {
          cashbackPercent =
            cashbackType === StoreCashbackTypeEnum.GENERAL
              ? storeCashbackConfig.getPercent()
              : cashbackType === StoreCashbackTypeEnum.PER_PRODUCT
                ? product.getCashbackPercent()
                : 0;
          cashbackAmount = (finalPrice * quantity * cashbackPercent) / 100;
          if (isDiscounted && !storeCashbackConfig.getIncludeDiscounted()) cashbackAmount = 0;
        }

        const result = new OrderItemEntity()
          .buildProductId(product.getId().toHexString())
          .buildStoreId(store.getId().toHexString())
          .buildQuantity(quantity)
          .buildPrice(price)
          .buildDiscountAmount(appliedDiscount)
          .buildDiscountPercent(discountPercent)
          .buildDiscountPrice(discountPrice)
          .buildFinalPrice(finalPrice)
          .buildCashbackEarned(cashbackAmount)
          .buildCashbackPercent(cashbackPercent)
          .buildHasDiscount(isDiscounted);

        let storeOrderEntity = storeOrdersMap.get(store.getId().toHexString());
        if (!storeOrderEntity) {
          storeOrderEntity = new StoreOrderEntity()
            .buildStoreId(store.getId())
            .buildOrderId(dummyOrderId)
            .buildSellerId(store.getSeller() as Types.ObjectId)
            .buildStoreName(store.getName())
            .buildStoreAvatar(store.getAvatar())
            .buildTotalAmount(itemTotalAmount)
            .buildDiscountAmount(itemDiscountAmount)
            .buildSubTotal(itemSubTotal)
            .buildCashbackType(cashbackType)
            .buildCashbackPercent(cashbackPercent)
            .buildCashbackEarned(cashbackAmount)
            .buildItems([result.convertToSchema()])
            .buildIsPreOrder(isItemPreOrder);
          storeOrdersMap.set(store.getId().toHexString(), storeOrderEntity);
        } else {
          const prevTotal = storeOrderEntity.getTotalAmount();
          const prevDiscount = storeOrderEntity.getDiscountAmount();
          const prevSub = storeOrderEntity.getSubTotal();
          const prevCashback = storeOrderEntity.getCashbackEarned();
          storeOrderEntity
            .buildTotalAmount(prevTotal + itemTotalAmount)
            .buildDiscountAmount(prevDiscount + itemDiscountAmount)
            .buildSubTotal(prevSub + itemSubTotal)
            .buildCashbackEarned(prevCashback + cashbackAmount)
            .buildItems([...storeOrderEntity.getItems().map((i) => i.convertToSchema()), result.convertToSchema()]);
          if (isItemPreOrder) storeOrderEntity.buildIsPreOrder(true);
        }
        return { result, basketProduct };
      }),
    );
    const validItems = basketModifiedData.filter((item) => item !== null);
    if (!validItems.length || !allItemExist) {
      throw new ItemsNotEnaughInStock();
    }

    if (promoCode && promoCode.ownerType === PromoCodeOwnerTypeEnum.STORE && promoCode.type === PromoCodeTypeEnum.FIXED) {
      const storeOrder = storeOrdersMap.get(promoCode.store?.toString());
      promoDiscountAmount = Math.min(promoCode.value, storeOrder?.getTotalAmount() ?? 0);
      totalAmount -= promoDiscountAmount;
    }
    if (promoCode && promoCode.ownerType === PromoCodeOwnerTypeEnum.MARKETPLACE) {
      promoDiscountAmount = promoCode.type === PromoCodeTypeEnum.PERCENTAGE ? (totalAmount * promoCode.value) / 100 : promoCode.value;
      promoDiscountAmount = Math.min(promoDiscountAmount, totalAmount);
      totalAmount -= promoDiscountAmount;
    }

    return { totalAmount, subTotal, discountAmount, product: productId, promoDiscountAmount };
  }
}
