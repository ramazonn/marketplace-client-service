import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CreateOrderParams, ItemsNotEnaughInStock, PromocodeIsInvalidError } from '../../infrastructure';
import {
  BrandsEntity,
  LanguageEnum,
  OrderEntity,
  OrderItemEntity,
  OrderStatusEnum,
  PaymentLogEntity,
  PaymentLogTypeEnum,
  PaymentTypeEnum,
  ProductEntity,
  ProductStatusEnum,
  Redis,
  Repository,
  SpecialEventStatusEnum,
  SpecialEventEntity,
  SpecialEventOrderEntity,
  SpecialEventProductEntity,
  CheckPromoCodeStatusEnum,
  PromoCodeTypeEnum,
  PromoCodeEntity,
  DeliveryAddressTypeEnum,
  StoreCashbackTypeEnum,
  OrderChangeLogsEntity,
  StoreOrderEntity,
  UserCashbackEntity,
  UserCashbackLogEntity,
  UserCashbackLogType,
  UserCashbackLogSourceEnum,
  BaseError,
  ErrorCodeEnum,
  EventTypeEnum,
  PromoCodeOwnerTypeEnum,
  TranslatesSchema,
} from '@ubaytools/core';
import { Types } from 'mongoose';
import {
  OctoPaymentStatus,
  OctoService,
  TelegramMessageSender,
  OrderDetailTGBotSenderParamsInterface,
  OrderQueueService,
  EventQueueService,
  OrderNotificationQueueService,
  UzumService,
} from '../../services';
import { ImanService } from '../../services/iman';
import { CalculateTotalAmountUseCase, FindDeliveryRuleByAmountUseCase } from '../../usecases';
import axios from 'axios';
import { getBaseLanguage } from '../../utils';

@prefix('/order')
export default class CreateOrderController {
  @request('post', '/create')
  @summary('Create Order')
  @security([])
  @tags(['Orders'])
  @body((CreateOrderParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: CreateOrderParams;
    try {
      params = await new CreateOrderParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }

    try {
      const interestProducts = new Set<string>();
      const interestCategories = new Set<string>();
      const interestBrands = new Set<string>();
      const redisClient = await Redis.getInstance();

      const categoryKey = `${process.env.NODE_ENV}:user:interest:categories:${context.client.getId().toString()}`;
      const productKey = `${process.env.NODE_ENV}:user:interest:products:${context.client.getId().toString()}`;
      const brandKey = `${process.env.NODE_ENV}:user:interest:brands:${context.client.getId().toString()}`;

      let promoCodeDiscount = 0;
      let totalAmount = 0;
      let discountAmount = 0;
      let subTotal = 0;
      let promoCode: {
        id: string;
        type: PromoCodeTypeEnum;
        description: TranslatesSchema;
        value: number;
        ownerType: PromoCodeOwnerTypeEnum;
        store?: Types.ObjectId;
      };

      const cashbackUsageMap = new Map<string, { requestedCashbackAmount: number; minimumOrderAmountToUseCashback: number }>();
      for (const cashbackUsage of params.cashbackUsage ?? []) {
        let amount = cashbackUsage.amount;
        const cashbackUsageMapElement = cashbackUsageMap.get(cashbackUsage.storeId);
        if (cashbackUsageMapElement) {
          amount = cashbackUsage.amount + cashbackUsageMapElement.requestedCashbackAmount;
        }
        cashbackUsageMap.set(cashbackUsage.storeId, {
          requestedCashbackAmount: amount,
          minimumOrderAmountToUseCashback: cashbackUsageMapElement?.minimumOrderAmountToUseCashback ?? 0,
        });
      }

      if (params.promoCode) {
        const checkPromocodeResult = await Repository.PromoCodes().checkPromoCode(params.promoCode, context.client.getId());
        if (checkPromocodeResult.status !== CheckPromoCodeStatusEnum.VALID) {
          throw new PromocodeIsInvalidError();
        }
        promoCode = checkPromocodeResult.promocode//await Repository.PromoCodes().getById(new Types.ObjectId(checkPromocodeResult.promocode.id));
      }
      const orderToCreate = new OrderEntity();
      orderToCreate
        .buildId(new Types.ObjectId())
        .buildStatus(OrderStatusEnum.PENDING)
        .buildUser(context.client.getId())
        .buildUserData({
          id: context.client.getId(),
          username: params.username,
          phoneNumber: params.phoneNumber,
          needToCall: params.needToCall ?? true,
        })
        .buildTotalAmount(totalAmount)
        .buildDiscountAmount(discountAmount)
        .buildSubTotal(subTotal)
        .buildPaymentType(params.paymentType)
        .buildPaymentData(params.paymentData)
        .buildDeliveryAddressType(params.deliveryAddressType)
        .buildShippingAddress(params.address)
        .buildUrgentDelivery(params.urgentDelivery);
      // let createdOrder = await Repository.Orders().create(orderToCreate)
      // totalAmountdan promocode ni minus qilish cashbackdan to'lovlarni chegirmalarni ayirib bo'lgandan keyin qilish kerak

      const manager = await Repository.Managers().getById(new Types.ObjectId(params.manager));
      if (manager) {
        orderToCreate.buildManager(new Types.ObjectId(params.manager));
        orderToCreate.buildManagerName(manager.getName());
      }

      let specialEventOrders: Array<{ specialEventOrder: SpecialEventOrderEntity; specialEventProduct: SpecialEventProductEntity }> = [];
      let allItemExist = true;
      let storesCashback = new Map();
      let storeOrdersMap: Map<string, StoreOrderEntity> = new Map();
      let basketModifiedData = await Promise.all(
        params?.products?.map(async (item) => {
          const basketProduct = await Repository.UserLikedProducts().getById(new Types.ObjectId(item.basketId));
          if (!basketProduct) {
            // Basket product not found
            return null;
          }

          const product = basketProduct.getProduct() as ProductEntity;

          const productId = product.getId().toString();
          const categoryId = product.getCategory()?.toString();

          const brand = product.getProductInfo().getBrand() as BrandsEntity;
          const brandId = brand?.getId()?.toString();

          interestProducts.add(productId);

          if (categoryId) {
            interestCategories.add(categoryId);
          }

          if (brandId) {
            interestBrands.add(brandId);
          }

          // this skip product count check if it is pre-order
          let isItemPreOrder = product.getIsPreOrder() ?? false;
          if (!isItemPreOrder) {
            if (product.getCount() < basketProduct.getCountInBasked()) {
              allItemExist = false;
              return null;
            }
          }

          const specialEvent = basketProduct.getSpecialEvent() as SpecialEventEntity;
          const specialEventProduct = await Repository.SpecialEventProducts().findByProductAndSpecialEvent(product.getId(), specialEvent?.getId());
          const limitForSale = specialEventProduct?.getLimitForSale();
          const soldCount = specialEventProduct?.getSoldCount() + basketProduct.getCountInBasked();

          if (specialEvent && specialEvent.getStatus() === SpecialEventStatusEnum.ACTIVE && soldCount > limitForSale) {
            allItemExist = false;
            return null;
          }
          let price = product.getProductInfo().getCurrentPrice();
          let discountPrice = product.getProductInfo().getDiscountPrice() ?? 0;
          let discountPercent = product.getProductInfo().getDiscountPercent() ?? 0;

          if (
            specialEvent &&
            specialEvent.getStatus() === SpecialEventStatusEnum.ACTIVE &&
            specialEventProduct &&
            specialEventProduct.getIsActive()
          ) {
            discountPrice = specialEventProduct.getDiscountPrice();
            discountPercent = specialEventProduct.getDiscountPercent();
            const specialEventOrderToCreate = new SpecialEventOrderEntity()
              .buildSpecialEvent(specialEvent.getId())
              .buildOrder(orderToCreate.getId())
              .buildUser(context.client.getId())
              .buildQuantity(basketProduct.getCountInBasked());
            specialEventOrders.push({ specialEventOrder: specialEventOrderToCreate, specialEventProduct });
          }

          let isDiscounted = false;
          let appliedDiscount = 0;
          if (discountPrice > 0) {
            appliedDiscount = price - discountPrice;
            isDiscounted = true;
          }
          const finalPrice = price - appliedDiscount;
          const quantity = basketProduct.getCountInBasked();
          let itemDiscountAmount = appliedDiscount * quantity;
          let itemTotalAmount = finalPrice * quantity;
          let itemSubTotal = price * quantity;
          totalAmount += itemTotalAmount;
          subTotal += itemSubTotal;
          discountAmount += itemDiscountAmount;

          const store = await Repository.Stores().getById(product.getStore() as Types.ObjectId);

          const storeCashbackConfig = store.getCashbackConfig();
          const minimumOrderAmountToUseCashback = storeCashbackConfig.getMinimumOrderAmountToUseCashback();
          const requestedCashbackAmount = cashbackUsageMap.get(store.getId().toHexString())?.requestedCashbackAmount ?? 0;
          cashbackUsageMap.set(store.getId().toHexString(), { requestedCashbackAmount, minimumOrderAmountToUseCashback });

          let cashbackAmount = 0;
          let cashbackPercent = 0;
          let cashbackType: StoreCashbackTypeEnum | null = null;
          if (storeCashbackConfig.getEnabled()) {
            cashbackType = storeCashbackConfig.getType();
            cashbackPercent =
              cashbackType == StoreCashbackTypeEnum.GENERAL
                ? storeCashbackConfig.getPercent()
                : cashbackType == StoreCashbackTypeEnum.PER_PRODUCT
                  ? product.getCashbackPercent()
                  : 0;
            cashbackAmount = (finalPrice * quantity * cashbackPercent) / 100;
            const includeDiscounted = storeCashbackConfig.getIncludeDiscounted();
            if (isDiscounted) {
              if (!includeDiscounted) {
                cashbackAmount = 0;
              }
            }
          }

          const result = new OrderItemEntity()
            .buildProductId(product.getId().toHexString())
            .buildStoreId(store.getId().toHexString())
            .buildProductName(product.getName().convertToSchema())
            .buildBrand((product.getProductInfo().getBrand() as BrandsEntity)?.getTitle()?.getByLang(context.lang || LanguageEnum.UZ))
            .buildBarcode(product?.getProductInfo()?.getBarcode())
            .buildSkuCode(product?.getProductInfo()?.getSKUCode())
            .buildIKPU(product?.getProductInfo()?.getIKPU())
            .buildPackageCode(product?.getProductInfo()?.getPackageCode())
            .buildItemCode(product?.getItemCode())
            .buildWarehouseCode(product?.getCountFromEshop() ? 'eshop' : '01')
            .buildQuantity(quantity)
            .buildPrice(price)
            .buildDiscountAmount(appliedDiscount)
            .buildDiscountPercent(discountPercent)
            .buildDiscountPrice(discountPrice)
            .buildFinalPrice(finalPrice)
            .buildCashbackEarned(cashbackAmount)
            .buildCashbackPercent(cashbackPercent)
            .buildHasDiscount(isDiscounted)
            .buildAttachments(product.getAttachments())
            .buildIsPreOrder(isItemPreOrder);

          let storeOrderEntity = storeOrdersMap.get(store.getId().toHexString());

          if (!storeOrderEntity) {

            let newStoreOrderEntity = new StoreOrderEntity();
            newStoreOrderEntity
              .buildStoreId(store.getId())
              .buildOrderId(orderToCreate.getId())
              .buildSellerId(store.getSeller() as Types.ObjectId)
              .buildStoreId(store.getId())
              .buildStoreName(store.getName())
              .buildStoreAvatar(store.getAvatar())
              .buildTotalAmount(itemTotalAmount)
              .buildDiscountAmount(itemDiscountAmount)
              .buildSubTotal(itemSubTotal)
              .buildCashbackType(cashbackType)
              .buildCashbackPercent(cashbackPercent)
              .buildCashbackEarned(cashbackAmount)
              .buildItems([result.convertToSchema()])
              .buildUserData({
                id: context.client.getId(),
                username: params.username,
                phoneNumber: params.phoneNumber,
                needToCall: params.needToCall ?? true,
              })
              .buildIsPreOrder(isItemPreOrder);
            orderToCreate.buildIsPreOrder(isItemPreOrder);

            storeOrdersMap.set(store.getId().toHexString(), newStoreOrderEntity);
          } else {
            itemTotalAmount += storeOrderEntity.getTotalAmount();
            itemDiscountAmount += storeOrderEntity.getDiscountAmount();
            itemSubTotal += storeOrderEntity.getSubTotal();
            cashbackAmount += storeOrderEntity.getCashbackEarned();
            storeOrderEntity.buildTotalAmount(itemTotalAmount);
            storeOrderEntity.buildDiscountAmount(itemDiscountAmount);
            storeOrderEntity.buildSubTotal(itemSubTotal);
            storeOrderEntity.buildCashbackEarned(cashbackAmount);
            storeOrderEntity.buildItems([...storeOrderEntity.getItems().map((item) => item.convertToSchema()), result.convertToSchema()]);
            if (isItemPreOrder) {
              storeOrderEntity.buildIsPreOrder(isItemPreOrder);
              orderToCreate.buildIsPreOrder(isItemPreOrder);
            }
          }

          return { result, basketProduct: basketProduct.getId() };
        }),
      );

      if (!basketModifiedData.length) {
        throw new ItemsNotEnaughInStock();
      }

      if (!allItemExist) {
        throw new ItemsNotEnaughInStock();
      }

      // storeIds actually present in this order (server truth)
      const storeIdsInOrder = new Set<string>([...storeOrdersMap.keys()]);

      for (const [storeId, { requestedCashbackAmount }] of cashbackUsageMap.entries()) {
        if (!storeIdsInOrder.has(storeId)) {
          // client is trying to spend cashback for a store not in this basket
          throw new Error(`INVALID_CASHBACK_STORE:${storeId}`);
        }
        if (requestedCashbackAmount < 0) {
          throw new Error(`INVALID_CASHBACK_AMOUNT:${storeId}`);
        }
      }

      const userId = context.client.getId();
      const storeObjectIds = [...storeIdsInOrder].map((id) => new Types.ObjectId(id));

      const wallets = await Repository.UserCashback().list(
        { page: 1, size: storeObjectIds.length },
        { user: new Types.ObjectId(userId), store: { $in: storeObjectIds } },
      );

      // Map storeId -> available cashback
      const userCashbackBalancesMap = new Map<string, UserCashbackEntity>();
      for (const w of wallets) {
        userCashbackBalancesMap.set((w.getStore() as Types.ObjectId).toString(), w);
      }

      let totalCashbackSpent = 0;
      let totalCashbackEarned = 0;
      let totalUpdatedItems = [];

      for (const [storeId, storeOrderEntity] of storeOrdersMap.entries()) {

        const { requestedCashbackAmount, minimumOrderAmountToUseCashback } = cashbackUsageMap.get(storeId);

        // store payable amount BEFORE cashback (currently storeOrderEntity.getTotalAmount())
        const storePayable = storeOrderEntity.getTotalAmount();

        // Validate
        if (requestedCashbackAmount > 0 && storeOrderEntity.getTotalAmount() < minimumOrderAmountToUseCashback) {
          throw new BaseError(
            `Store total amount is less than minimum order amount.`,
            {
              en: 'Store total amount is less than minimum order amount.',
              ru: 'Сумма заказа магазина меньше минимальной суммы заказа.',
              uz: 'Magazin summasi minimal buyurtma summasidan kam.',
            },
            ErrorCodeEnum.UNPROCESSABLE_ENTITY,
          );
        }
        if (requestedCashbackAmount > 0) {
          const available = userCashbackBalancesMap.get(storeId)?.getCashbackAmount() ?? 0;

          if (requestedCashbackAmount > available) {
            throw new BaseError(
              `Insufficient cashback.`,
              {
                en: 'Insufficient cashback.',
                ru: 'Недостаточно кешбека.',
                uz: "Ke'chbek yetarli emas.",
              },
              ErrorCodeEnum.UNPROCESSABLE_ENTITY,
            );
          }
        }
        if (requestedCashbackAmount > storePayable) {
          throw new BaseError(
            `Cashback exceeds store total.`,
            {
              en: 'Cashback exceeds store total.',
              ru: 'Кешбек превышает сумму заказа магазина.',
              uz: "Ke'chbek magazin summasidan oshib ketadi.",
            },
            ErrorCodeEnum.UNPROCESSABLE_ENTITY,
          );
        }

        const paidByUser = storePayable - requestedCashbackAmount;
        // Apply reductions (order totals were computed already)
        storeOrderEntity.buildTotalAmount(paidByUser);
        storeOrderEntity.buildPayedFromCashback(requestedCashbackAmount);
        // const paidRatio = (paidByUser) / storePayable

        // if (storeOrderEntity.getCashbackType() !== StoreCashbackTypeEnum.BASED_ON_ORDER_AMOUNT) {
        let totalCashbackEarnedStoreBased = 0;
        const items = storeOrderEntity.getItems();
        storeOrderEntity.buildItems([]);
        let storeUpdatedItems = [];
        let allocatedCashbackSum = 0;
        items.forEach((item, index) => {
          const itemTotalAmount = item.getFinalPrice() * item.getQuantity();
          const cashbackRatio = itemTotalAmount / storePayable;
          let paidFromCashback = 0;

          if (index < items.length - 1) {
            paidFromCashback = Math.round(requestedCashbackAmount * cashbackRatio);

            allocatedCashbackSum += paidFromCashback;
          } else {
            paidFromCashback = requestedCashbackAmount - allocatedCashbackSum;
          }

          item.buildPaidFromCashback(paidFromCashback);
          const finalPrice = Number(((item.getFinalPrice() * item.getQuantity() - paidFromCashback) / item.getQuantity()).toFixed(2));
          item.buildFinalPrice(finalPrice);
          const cashbackErned = Math.round((item.getFinalPrice() * item.getQuantity() * (item.getCashbackPercent() ?? 0)) / 100);
          // cashbackErned = Math.round(((item.getFinalPrice() * item.getQuantity() * paidRatio) * item.getCashbackPercent()) / 100)
          item.buildCashbackEarned(cashbackErned);
          storeUpdatedItems.push(item.convertToSchema());

          totalCashbackEarnedStoreBased += cashbackErned;
        });
        totalUpdatedItems.push(...storeUpdatedItems);
        storeOrderEntity.buildItems(storeUpdatedItems);
        storeOrderEntity.buildCashbackEarned(totalCashbackEarnedStoreBased);
        // }

        if (promoCode && promoCode.ownerType === PromoCodeOwnerTypeEnum.STORE && promoCode.store?.toString() === storeId) {
          let storePromoDiscount =
            promoCode.type === PromoCodeTypeEnum.PERCENTAGE
              ? (storeOrderEntity.getTotalAmount() * promoCode.value) / 100
              : promoCode.value;

          if (storePromoDiscount > storeOrderEntity.getTotalAmount()) {
            storePromoDiscount = storeOrderEntity.getTotalAmount();
          }

          storeOrderEntity.buildTotalAmount(storeOrderEntity.getTotalAmount() - storePromoDiscount);

          promoCodeDiscount += storePromoDiscount;
          totalAmount -= storePromoDiscount;
        }

        totalAmount -= requestedCashbackAmount; // 🔥 final order payable reduced
        totalCashbackSpent += requestedCashbackAmount;
        totalCashbackEarned += storeOrderEntity.getCashbackEarned();
      }

      orderToCreate.buildItems(totalUpdatedItems);
      orderToCreate.buildCashbackEarned(totalCashbackEarned);
      orderToCreate.buildPayedFromCashback(totalCashbackSpent);

      // if (promoCode) {
      //   promoCodeDiscount = promoCode.getType() === PromoCodeTypeEnum.PERCENTAGE ? (totalAmount * promoCode.getValue()) / 100 : promoCode.getValue();
      //   totalAmount = totalAmount - promoCodeDiscount;
      //   orderToCreate
      //     .buildPromoCode(promoCode.getId())
      //     .buildPromoCodeData({ code: params.promoCode, value: promoCode.getValue(), type: promoCode.getType(), discountAmount: promoCodeDiscount });
      // }

      if (promoCode && promoCode.ownerType === PromoCodeOwnerTypeEnum.MARKETPLACE) {
        promoCodeDiscount = promoCode.type === PromoCodeTypeEnum.PERCENTAGE ? (totalAmount * promoCode.value) / 100 : promoCode.value;

        if (promoCodeDiscount > totalAmount) {
          promoCodeDiscount = totalAmount;
        }

        totalAmount -= promoCodeDiscount;
      }

      if (promoCode) {
        orderToCreate.buildPromoCode(new Types.ObjectId(promoCode.id)).buildPromoCodeData({
          code: params.promoCode,
          value: promoCode.value,
          type: promoCode.type,
          discountAmount: promoCodeDiscount,
        });
      }

      let deliveryPrice = 0;

      // if (params.deliveryAddressType !== DeliveryAddressTypeEnum.UBAY_POINT) {
      //   const { totalAmount: totalAmountToCalculateDeliveryPrice } = await CalculateTotalAmountUseCase.execute({ products: params.products });
      //   if (params.paymentType !== PaymentTypeEnum.IMAN_PAY) {
      //     const deliveryRule = await FindDeliveryRuleByAmountUseCase.execute(totalAmountToCalculateDeliveryPrice);
      //     deliveryPrice = deliveryRule?.deliveryPrice ?? 0;
      //   }
      // }

      totalAmount += deliveryPrice;

      if (params.deliveryPrice !== deliveryPrice) {
        throw new BaseError(
          'Delivery price is not correct. Please check the delivery price.',
          {
            en: 'Delivery price is not correct. Please check the delivery price.',
            ru: 'Цена доставки некорректна. Пожалуйста, проверьте цену доставки.',
            uz: "Yetkazib berish narxi noto'g'ri. Iltimos, yetkazib berish narxini tekshirib ko'ring.",
          },
          ErrorCodeEnum.UNPROCESSABLE_ENTITY,
        );
      }

      if (params.totalAmount !== totalAmount) {
        throw new BaseError(
          'Total amount is not correct. Please check the total amount.',
          {
            en: 'Total amount is not correct. Please check the total amount.',
            ru: 'Сумма заказа некорректна. Пожалуйста, проверьте сумму заказа.',
            uz: "Buyurtma summasi noto'g'ri. Iltimos, buyurtma summasini tekshirib ko'ring.",
          },
          ErrorCodeEnum.UNPROCESSABLE_ENTITY,
        );
      }

      orderToCreate.buildTotalAmount(totalAmount);
      orderToCreate.buildDeliveryPrice(deliveryPrice);
      if (params.paymentType === PaymentTypeEnum.CASH) {
        orderToCreate.buildStatus(OrderStatusEnum.PROCESSING);
      }


      // orderToCreate.buildItems(basketModifiedData?.map((item) => item.result?.convertToSchema()));
      orderToCreate.buildTotalAmount(totalAmount);
      orderToCreate.buildDiscountAmount(discountAmount);
      orderToCreate.buildSubTotal(subTotal);
      // orderToCreate.buildPayedFromCashback(totalCashbackSpent)

      let createdOrder = await Repository.Orders().create(orderToCreate);

      void EventQueueService.getInstance().publishToQueue({
        userId: context.client.getId().toString(),
        eventType: EventTypeEnum.PURCHASE,
        timestamp: new Date(),
        metadata: {
          order: createdOrder.getId().toString(),
          totalAmount: createdOrder.getTotalAmount(),
          items: createdOrder.getItems().map((item) => ({
            product: item.getProductId().toString(),
            price: item.getFinalPrice(),
            quantity: item.getQuantity(),
          })),
        },
      });

      const pipeline = await redisClient.pipeline();

      for (const productId of interestProducts) {
        pipeline.zIncrBy(productKey, 3, productId);
      }

      for (const categoryId of interestCategories) {
        pipeline.zIncrBy(categoryKey, 3, categoryId);
      }

      for (const brandId of interestBrands) {
        pipeline.zIncrBy(brandKey, 3, brandId);
      }

      await pipeline.exec();

      let changes: Record<string, any> = {};
      changes['created'] = { oldValue: null, newValue: createdOrder.getOrderCode() };
      const orderChangeLog = new OrderChangeLogsEntity();
      orderChangeLog.buildOrder(createdOrder.getId());
      orderChangeLog.buildAdmin(context.client.getId());
      orderChangeLog.buildAdminData({ fullName: params.username, phoneNumber: params.phoneNumber });
      orderChangeLog.buildChanges(changes);
      await Repository.OrderChangeLogs().create(orderChangeLog);

      if (promoCode) {
        // need to push queue
        await Repository.PromoCodes().incrementUsedCount(new Types.ObjectId(promoCode.id));
        await Repository.PromoCodeUsages().incrementUserUsageCount(new Types.ObjectId(promoCode.id), context.client.getId());
      }

      await Promise.all(
        basketModifiedData.map(async (item) => {
          await Repository.UserLikedProducts().deleteById(item.basketProduct);
        }),
      );

      await Promise.all(
        specialEventOrders.map(async (item) => {
          await Repository.SpecialEventOrders().create(item.specialEventOrder);
          const specialEventProduct = item.specialEventProduct;
          const soldCount = item.specialEventProduct.getSoldCount() + item.specialEventOrder.getQuantity();
          const limitForSale = item.specialEventProduct.getLimitForSale();
          specialEventProduct.buildSoldCount(soldCount);
          if (soldCount === limitForSale) {
            specialEventProduct.buildIsActive(false);
          }
          await Repository.SpecialEventProducts().update(specialEventProduct);
        }),
      );

      await Promise.all(
        createdOrder.getItems().map(async (item) => {
          const productId = new Types.ObjectId(item.getProductId());
          const product = await Repository.Products().getById(productId);
          if (product) {
            if (!product.getIsPreOrder()) {
              const orderQuantity = item.getQuantity();
              let productCount = product.getCount();
              const minimumCount = product.getMinimumCount();
              productCount = productCount - orderQuantity;
              let newStatus = ProductStatusEnum.IN_STOCK;

              if (productCount <= 10 && productCount > minimumCount) {
                newStatus = ProductStatusEnum.LOW_STOCK;
              } else if (productCount <= minimumCount) {
                newStatus = ProductStatusEnum.OUT_OF_STOCK;
              }

              product.buildStatus(newStatus);
              product.buildCount(productCount);
              await Repository.Products().update(product);
            }

            const cacheKey = `${process.env.NODE_ENV}:product:basic:${productId}`;
            const cacheDetailKey = `${process.env.NODE_ENV}:product:detail:${productId}`;

            await redisClient.deleteKeysByPattern(cacheKey);
            await redisClient.deleteKeysByPattern(cacheDetailKey);
          }
        }),
      );
      const storeOrders = [];
      for (let [store, order] of storeOrdersMap) {

        const storeOrder = await Repository.StoreOrders().create(order);
        storeOrders.push(storeOrder.convertToSchema());

        const { requestedCashbackAmount } = cashbackUsageMap.get(store) ?? { requestedCashbackAmount: 0, minimumOrderAmountToUseCashback: 0 };
        if (requestedCashbackAmount > 0) {
          let userCashbackBalance = userCashbackBalancesMap.get(store);
          userCashbackBalance.buildCashbackAmount(userCashbackBalance.getCashbackAmount() - requestedCashbackAmount);
          await Repository.UserCashback().update(userCashbackBalance);

          const userCashbackLog = new UserCashbackLogEntity();
          userCashbackLog.buildAmount(requestedCashbackAmount);
          userCashbackLog.buildType(UserCashbackLogType.USED);
          userCashbackLog.buildUser(userId);
          userCashbackLog.buildStore(new Types.ObjectId(store));
          userCashbackLog.buildSource(UserCashbackLogSourceEnum.ORDER);
          userCashbackLog.buildOrder(createdOrder.getId());
          userCashbackLog.buildStoreOrder(storeOrder.getId());
          await Repository.UserCashbackLog().create(userCashbackLog);
        }
      }


      // createdOrder.buildStoreOrders(storeOrders)
      await Repository.Orders().update(createdOrder);

      // await redisClient.deleteKeysByPattern('carousel:list:');
      // await redisClient.deleteKeysByPattern('carousel:count');
      await redisClient.deleteKeysByPattern('special-event:list:');
      await redisClient.deleteKeysByPattern('special-event:count');

      const response = { id: createdOrder.getId().toString() };

      if (params.paymentType === PaymentTypeEnum.CLICK) {
        response['payment'] = {
          url: `${process.env.CLICK_URL}?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID
            }&amount=${totalAmount}&transaction_param=${createdOrder.getOrderCode().toString()}&return_url=${process.env.CLICK_RETURN_URL}`,
          error: null,
          amount: totalAmount,
        };
      }
      if (params.paymentType === PaymentTypeEnum.CARD) {
        try {
          const octoService = new OctoService({
            orderCode: createdOrder.getOrderCode().toString(),
            totalAmount: totalAmount,
            user: { id: context.client.getId().toString(), phoneNumber: context.client.getPhoneNumber(), lang: context.lang.toLowerCase() || 'ru' },
          });
          const payData = await octoService.preparePayment();
          const paymentLog = new PaymentLogEntity()
            .buildMerchantTransId(createdOrder.getOrderCode())
            .buildLogData(payData)
            .buildPaymentType(PaymentTypeEnum.CARD)
            .buildType(PaymentLogTypeEnum.PREPARE);
          await Repository.PaymentLog().create(paymentLog);
          if (payData && payData?.data?.status == OctoPaymentStatus.CREATED) {
            response['payment'] = {
              url: payData?.data?.octo_pay_url,
              error: null,
              amount: totalAmount,
            };
          } else if (payData && payData.error) {
            console.error('Error in octo payment', payData.error);
            response['payment'] = { error: payData.error, url: null };
          }
        } catch (error) {
          console.error('Error in octo payment', error);
          response['payment'] = { error: 'Payment error', url: null };
        }
      }

      if (params.paymentType === PaymentTypeEnum.IMAN_PAY) {
        try {
          const iman = await ImanService.getInstance().createBasket(createdOrder);
          response['payment'] = { ...iman.data.reference, url: iman.data.reference.deep_link, error: null, amount: totalAmount };
          const paymentLog = new PaymentLogEntity()
            .buildMerchantTransId(createdOrder.getOrderCode())
            .buildPaymentType(PaymentTypeEnum.IMAN_PAY)
            .buildLogData(iman.data)
            .buildType(PaymentLogTypeEnum.PREPARE);
          await Repository.PaymentLog().create(paymentLog);
        } catch (error) {
          console.error('Error in iman payment', error);
          response['payment'] = { error: 'Payment error', url: null };
        }
      }

      if (params.paymentType === PaymentTypeEnum.PAYME) {
        const paymeId = process.env.PAYME_MERCHANT_ID;
        const orderId = createdOrder.getOrderCode().toString();

        const amount = totalAmount * 100;

        const returnUrl = process.env.PAYME_RETURN_URL;

        console.log('Payme payment params', { paymeId, orderId, amount, returnUrl });

        const paramsString = `m=${paymeId};ac.order_id=${orderId};a=${amount};c=${returnUrl}`;

        console.log('Payme params string', paramsString);

        const encoded = Buffer.from(paramsString).toString('base64');

        const paymentUrl =`${process.env.PAYME_URL}/${encoded}`;

        response['payment'] = {
          url: paymentUrl,
          error: null,
          amount: totalAmount,
        };
      }

      // Merchant implementation
      // if (params.paymentType === PaymentTypeEnum.UZUM) {

      //   const serviceId = process.env.UZUM_SERVICE_ID;

      //   const orderCode = createdOrder.getOrderCode().toString();
      //   const amount = totalAmount*100;

      //   const paymentUrl = `${process.env.UZUM_API_URL}/open-service?serviceId=${serviceId}&orderId=${orderCode}&amount=${amount}`;

      //   response['payment'] = {
      //     url: paymentUrl,
      //     error: null,
      //     amount: totalAmount,
      //   };
      // }

      //  if (params.paymentType === PaymentTypeEnum.UZUM) {
      //   try {
      //     const orderNumber = createdOrder.getOrderCode().toString();
      //     const totalAmountTiyin = totalAmount * 100;

      //     const requestBody = {
      //       amount: totalAmountTiyin,
      //       currency: 860,
      //       orderNumber,
      //       clientId: createdOrder.getUser().toString(),
      //       viewType: 'REDIRECT',
      //       sessionTimeoutSecs: 1800,
      //       successUrl: process.env.UZUM_SUCCESS_URL,
      //       failureUrl: process.env.UZUM_FAILURE_URL,

      //       paymentParams: {
      //         operationType: 'PAYMENT',
      //         payType: 'ONE_STEP',
      //         phoneNumber: createdOrder.getUserData()?.getPhoneNumber(),
      //         // force3ds: true
      //       },

      //       merchantParams: {
      //         cart: {
      //           cartId: `${orderNumber}`,
      //           receiptType: 'PURCHASE',
      //           total: totalAmountTiyin,
      //           items: createdOrder.getItems().map((item) => {
      //             const itemTotal = item.getFinalPrice() * item.getQuantity() * 100;
      //             return {
      //               title: item.getProductName()?.getUz() || item.getProductName()?.getRu() || 'Product',
      //               productId: item.getProductId().toString(),
      //               quantity: item.getQuantity(),
      //               unitPrice: item.getFinalPrice() * 100,
      //               total: itemTotal,
      //               receiptParams: {
      //                 spic: item.getIKPU() || '08467001017000000',
      //                 packageCode: item.getPackageCode() || 1500776,
      //                 vatPercent: 12,
      //                 discount: item.getDiscountAmount() > 0 ? item.getDiscountAmount()*100 : 0,
      //                 TIN: process.env.COMPANY_TIN
      //               },
      //             };
      //           }),
      //         },
      //       },
      //     };

      //     const { data } = await axios.post(`${process.env.UZUM_BASE_URL}/api/v1/payment/register`, requestBody, {
      //       headers: {
      //         'X-Terminal-Id': process.env.UZUM_SERVICE_ID!,
      //         'X-API-Key': process.env.UZUM_API_KEY!,
      //         'Content-Language': 'uz-UZ',
      //         'Content-Type': 'application/json',
      //       },
      //     });

      //     if (data.errorCode === 0 && data.result) {

      //       const paymentLog = new PaymentLogEntity()
      //         .buildType(PaymentLogTypeEnum.PREPARE)
      //         .buildMerchantTransId(orderNumber)
      //         .buildPaymentType(PaymentTypeEnum.UZUM)
      //         .buildUzumTransactionId(data.result.orderId)
      //         .buildAmount(totalAmount)
      //         .buildCreateTime(Date.now())
      //         .buildLogData(requestBody)
      //         .buildResponse(data);

      //       await Repository.PaymentLog().create(paymentLog);
      //       response['payment'] = {
      //         url: data.result.paymentRedirectUrl,
      //         error: null,
      //         amount: totalAmount,
      //       };
      //     } else if (data && data.error) {
      //       console.error('Error in octo payment', data.error);
      //       response['payment'] = { error: data.error, url: null };
      //     }
      //   } catch (error: any) {
      //     console.error('UZUM PAYMENT ERROR', error?.response?.data || error)
      //   }
      // }

      // checkout implementation
      if (params.paymentType === PaymentTypeEnum.UZUM) {
        try {
          const paymentRegisterParams = {
            orderCode: createdOrder.getOrderCode().toString(),
            totalAmount: totalAmount,
            user: {
              id: context.client.getId().toString(),
              phoneNumber: context.client.getPhoneNumber(),
              lang: getBaseLanguage(context.lang) as LanguageEnum,
            },
            items: createdOrder.convertToSchema().items, // adjust to your actual order entity getter
          }
          const uzumService = new UzumService(paymentRegisterParams);

          const payData = await uzumService.paymentRegister();
          console.log("payData:", payData);

          const paymentLog = new PaymentLogEntity()
          .buildMerchantTransId(createdOrder.getOrderCode())
          .buildPaymentType(PaymentTypeEnum.UZUM)
          .buildAmount(totalAmount)
          .buildCreateTime(Date.now())
          .buildLogData(paymentRegisterParams)
          .buildResponse(payData);          
          
          if (payData && payData?.data?.errorCode === 0 && payData?.data?.result?.paymentRedirectUrl) {
            response['payment'] = {
              url: payData?.data?.result?.paymentRedirectUrl,
              error: null,
              amount: totalAmount,
            };
            paymentLog
            .buildType(PaymentLogTypeEnum.PREPARE)
            .buildUzumTransactionId(payData?.data?.result?.orderId);

          } else {
            response['payment'] = { error: payData?.message || 'Payment error', url: null };
            paymentLog.buildType(PaymentLogTypeEnum.FAILED)
            console.error('Error in uzum payment', payData?.message);
          }

          await Repository.PaymentLog().create(paymentLog);
        } catch (error) {
          console.error('Error in uzum payment', error);
          response['payment'] = { error: 'Payment error', url: null };
        }
      }


      // await CreateOrderController.sendTgNotification(createdOrder);
      await OrderNotificationQueueService.getInstance().publishOrderTelegramNotification(createdOrder.getId().toString(), 'send-order-telegram-notification');
      createdOrder.buildPaymentData(response['payment']);

      await Repository.Orders().update(createdOrder);

      // Publish order created event to BullMQ queue for processing by integrations-api service
      // This is done after all order creation logic completes successfully
      // Errors in queue publishing are logged but do not affect the order creation flow
      // const orderQueue = OrderQueueService.getInstance();
      // await orderQueue.publishCreatedOrderToQueue(createdOrder.getId().toString());


      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
      // return context.send.error(error?.response?.data?.error);
    }
  }

  private static async sendTgNotification(order: OrderEntity) {
    const shippingAddress: any = order.getShippingAddress();
    let deliveryAddressType = '';
    let formattedShippingAddress: { address: string; mapLink: string };
    switch (order.getDeliveryAddressType()) {
      case DeliveryAddressTypeEnum.DELIVERY_POINT:
        formattedShippingAddress = {
          address: `${shippingAddress?.name} - ${shippingAddress?.location?.address}`,
          mapLink: ``,
        };
        deliveryAddressType = 'UZPOST';
        break;
      case DeliveryAddressTypeEnum.UBAY_POINT:
        formattedShippingAddress = {
          address: `${shippingAddress?.name} - ${shippingAddress?.location?.name} - ${shippingAddress?.location?.phoneNumber}`,
          mapLink: ``,
        };
        deliveryAddressType = 'UBAY';

        break;
      case DeliveryAddressTypeEnum.LOCATION:
        formattedShippingAddress = {
          address: `${shippingAddress?.name}`,
          mapLink: `https://yandex.com/maps/?ll=${shippingAddress?.location?.longitude},${shippingAddress?.location?.latitude}&z=16&pt=${shippingAddress?.location?.longitude},${shippingAddress?.location?.latitude},pm2rdm`,
        };
        deliveryAddressType = 'ДОСТАВКА';

        break;
      default:
        formattedShippingAddress = {
          address: `${shippingAddress?.name}`,
          mapLink: ``,
        };
        break;
    }

    const params: OrderDetailTGBotSenderParamsInterface = {
      isPreOrder: order.getIsPreOrder(),
      orderCode: order.getOrderCode().toString(),
      customerName: order.getUserData()?.getUsername(),
      manager: order.getManagerName(),
      clientPhoneNumber: order.getUserData()?.getPhoneNumber(),
      deliveryAddressType,
      shippingAddress: formattedShippingAddress,
      urgentDelivery: order.getUrgentDelivery(),
      paymentType: order.getPaymentType(),
      promoCodeData: order.getPromoCodeData()
        ? {
          code: order.getPromoCodeData()?.getCode(),
          type: order.getPromoCodeData()?.getType(),
          value: order.getPromoCodeData()?.getValue(),
          discountAmount: order.getPromoCodeData()?.getDiscountAmount(),
        }
        : null,
      totalSum: order.getTotalAmount(),
      products: order.getItems().map((item) => ({
        name: item.getProductName().getRu(),
        quantity: item.getQuantity(),
        price: item.getPrice(),
        barcode: item.getBarcode() ?? null,
        discountPercent: item.getDiscountPercent(),
        finalPrice: item.getFinalPrice(),
      })),
      paidFromCashback: order.getPayedFromCashback() ?? 0,
      paid: order.getPaymentType() == PaymentTypeEnum.CASH ? true : false,
    };
    const tgMessageSender = new TelegramMessageSender();
    await tgMessageSender.sendOrderReportExcelDocument(params);
  }
}
