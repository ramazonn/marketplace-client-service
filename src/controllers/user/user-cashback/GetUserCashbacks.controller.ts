import { body, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { GetUserCashbacksParams } from '../../../infrastructure';
import { CloudFlareService, ProductStatusEnum, Repository, StoresEntity, UserCashbackEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

class UserCashbackResponse {
  id: string;
  storeId: string;
  storeName: string;
  storeAvatar: string;
  storeProductCount: number;
  storeAvgStars: number;
  cashbackAmount: number;
  minimumOrderAmountToUseCashback: number;
  constructor(userCashback: UserCashbackEntity, store: StoresEntity, productCount: number, avgStars: number) {
    this.id = userCashback.getId().toString();
    this.storeId = store.getId().toString();
    this.storeName = store.getName();
    this.storeAvatar = store.getAvatar() ? CloudFlareService.getImageUrlByFileID(store.getAvatar()) : null;
    this.storeProductCount = productCount;
    this.storeAvgStars = avgStars;
    this.cashbackAmount = userCashback.getCashbackAmount();
    this.minimumOrderAmountToUseCashback = store.getCashbackConfig().getMinimumOrderAmountToUseCashback() ?? 0;
  }
}

@prefix('/user/cashback')
export default class GetUserCashbacksController {
  @request('post', '/list')
  @summary('User cashback from all stores')
  @security([])
  @tags(['User Cashback'])
  @body((GetUserCashbacksParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params : GetUserCashbacksParams
    try {
      params = await new GetUserCashbacksParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const userId = context.client?.getId();
      let userCashbacks :UserCashbackEntity[]
      if (params.storeIds?.length > 0) {
        const storeIds = params.storeIds.map(id => new Types.ObjectId(id));
        userCashbacks = await Repository.UserCashback().list({}, { user: new Types.ObjectId(userId), store: { $in: storeIds } });
      } else {
        userCashbacks = await Repository.UserCashback().getByUser(userId);
      }
      let totalCashback = 0;
      let stores = [];
      
      for (const userCashback of userCashbacks) {
        const store = await Repository.Stores().getById(userCashback.getStore() as Types.ObjectId);
        if (!store) continue;
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
