import { path, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams } from '../../infrastructure';
import { CloudFlareService, LanguageEnum, NotFoundError, ProductStatusEnum, Repository, StoresEntity } from '@ubaytools/core';
import { Types } from 'mongoose';

class StoreDetailResponse {
  id: string;
  name: string;
  sku: string;
  description: string;
  avatar: string;
  avgStars: number | null;
  productCount: number;
  createdAt: Date;
  cover_banner: string;
  cover_mobile_banner: string;
  social_links: any;
  cashbackAmount: number;

  constructor(store: StoresEntity, productCount: number, cashbackAmount: number, avgStars: number, lang: LanguageEnum) {
    this.id = store.getId().toString();
    this.name = store.getName();
    this.sku = store.getShortname();
    this.description = store.getDescription()?.getByLang(lang) ?? null;
    this.avatar = store.getAvatar() ? CloudFlareService.getImageUrlByFileID(store.getAvatar()) : null;
    this.avgStars = avgStars;
    this.productCount = productCount ?? 0;
    this.createdAt = store.getCreatedAt();
    this.cover_banner = store?.getCoverBanner() ? CloudFlareService.getImageUrlByFileID(store?.getCoverBanner()) : null;
    this.cover_mobile_banner = store?.getCoverMobileBanner() ? CloudFlareService.getImageUrlByFileID(store?.getCoverMobileBanner()) : null;
    this.social_links = store?.getSocialLinks() ?? [];
    this.cashbackAmount = cashbackAmount;
  }
}

@prefix('/store')
export default class GetStoreDetailController {
  @request('get', '/detail/{storeId}')
  @summary('Store detail')
  @security([])
  @tags(['Store'])
  @path({ storeId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.storeId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const store = await Repository.Stores().getById(new Types.ObjectId(params.id));
      if (!store) {
        throw new NotFoundError('Store');
      }
      const userId = context.client?.getId();
      let cashbackAmount = 0;
      const avgStars = 4.5//await Repository.Products().getAverageStarsByStore(store.getId());    
      const userStoreCashback = await Repository.UserCashback().getByUserAndStore(userId, store.getId());
      if (userStoreCashback) {
          cashbackAmount = userStoreCashback.getCashbackAmount();
        }
      const productCount = await Repository.Products().countDocumentsByFilter({ store: store.getId(), status: { $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK] } });

      const response = new StoreDetailResponse(store, productCount, cashbackAmount, avgStars, context.lang );
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
