import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams, ListParams } from '../../../infrastructure';
import { BrandsEntity, CloudFlareService, LanguageEnum, NotFoundError, ProductStatusEnum, Repository, StoresEntity, UserCashbackEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

class UserCashbackResponse {
  id: string;
  storeId: string;
  storeName: string;
  storeAvatar: string;
  storeProductCount: number;
  storeAvgStars: number;
  cashbackAmount: number;
  constructor(userCashback: UserCashbackEntity, store: StoresEntity, productCount: number, avgStars: number) {
    this.id = userCashback.getId().toString();
    this.storeId = store.getId().toString();
    this.storeName = store.getName();
    this.storeAvatar = store.getAvatar() ? CloudFlareService.getImageUrlByFileID(store.getAvatar()) : null;
    this.storeProductCount = productCount;
    this.storeAvgStars = avgStars;
    this.cashbackAmount = userCashback.getCashbackAmount();
  }
}

@prefix('/user/cashback')
export default class GetUserCashbackController {
  @request('get', '/list')
  @summary('User cashback from all stores')
  @security([])
  @tags(['User Cashback'])
  static async controller(context: Context): Promise<void> {
    try {
      const userId = context.client?.getId();
      const userCashbacks = await Repository.UserCashback().getByUser(userId);
      let totalCashback = 0;
      let stores = [];
      for (const userCashback of userCashbacks) {
        const store = await Repository.Stores().getById(userCashback.getStore() as Types.ObjectId);
      const productCount = await Repository.Products().countDocumentsByFilter({ store: store.getId(), status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] } });
        const avgStars = 4.5//await Repository.Products().getAverageStarsByStore(store.getId());
        stores.push(new UserCashbackResponse(userCashback, store, productCount, avgStars));
        totalCashback += userCashback.getCashbackAmount();
      }
      const response = {
        stores,
        totalCashback: Number(totalCashback.toFixed(2))
      }
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
