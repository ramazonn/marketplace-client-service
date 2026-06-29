import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import {
  CategoriesModel,
  UserCashbackModel,
  UserAddressModel,
  ReviewsModel,
  CharacteristicsModel,
  UserModel,
  FaqsModel,
  OrderModel,
  StoresModel,
  BonussesModel,
  RolesModel,
  ActionLogModel,
  AdminsModel,
  ChatsModel,
  CompareModel,
  LifehacksModel,
  MessageModel,
  StoreOrderModel,
  ProcessHistoryModel,
  ProcessSettingsModel,
  ProductsModel,
  ProductsAwaitingUserReviewsModel,
  SpecialEventModel,
  SessionModel,
  SpecialEventProductModel,
  DeviceModel,
  UserActivityEventsModel,
  UserActivityStateModel,
  UserCashbackLogModel,
  UserLikedProductModel,
  UserSegmentsModel,
} from '@ubaytools/core';

@prefix('/product')
export default class CreateProductIndexesController {
  @request('post', '/create-index')
  @summary('Create MongoDB indexes manually')
  @security([])
  @tags(['Indexes'])
  static async controller(context: Context): Promise<void> {
    try {
      try {
        await Promise.all([
          ProductsModel.collection.dropIndex("normalizedSearchFields.name_1"),
          ProductsModel.collection.dropIndex("normalizedSearchFields.description_1"),
          ProductsModel.collection.dropIndex("normalizedSearchFields.tags_1"),
          ProductsModel.collection.dropIndex("normalizedSearchFields.category_1"),
          ProductsModel.collection.dropIndex("normalizedSearchFields.brand_1"),
        ]);

      } catch (error) {
        console.log(error);

      }

      await ProductsModel.collection.createIndex({
        "normalizedSearchFields.name": "text",
        "normalizedSearchFields.description": "text",
        "normalizedSearchFields.tags": "text",
        "normalizedSearchFields.category": "text",
        "normalizedSearchFields.brand": "text"
      }, { name: "normalizedSearchFields_text", background: true });

      return context.send.data({
        result: "ok",
      });
    } catch (error) {
      return context.send.error(error);
    }
  }
}