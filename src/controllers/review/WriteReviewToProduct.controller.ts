import { body, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { WriteReviewParams } from '../../infrastructure';
import {
  NotFoundError,
  OrderItemEntity,
  ProcessStepEnum,
  ProductsAwaitingUserReviewsStatusEnum,
  ProductStatsEntity,
  Redis,
  Repository,
  ReviewsEntity,
  StoreOrderEntity,
  UserEntity,
} from '@ubaytools/core';
import { Types } from 'mongoose';
import { ReviewQueueService, TelegramMessageSender } from '../../services';

@prefix('/review')
export default class WriteReviewToProductController {
  @request('post', '/write')
  @summary('Write Review')
  @security([])
  @tags(['Review'])
  @body((WriteReviewParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: WriteReviewParams;
    try {
      params = await new WriteReviewParams(context.request.body).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {

      const redisClient = await Redis.getInstance();

      const userId = context?.client?.getId();

      const key = `${process.env.NODE_ENV}:review:pending:user:${userId}`;

      const product = await Repository.Products().getById(new Types.ObjectId(params.product));
      if (!product) {
        throw new NotFoundError('Product');
      }

      const review = new ReviewsEntity()
        .buildUser(context?.client?.getId())
        .buildProduct(new Types.ObjectId(params.product))
        .buildStars(params.stars)
        .buildAdvantages(params.advantages)
        .buildDisadvantages(params.disadvantages)
        .buildDescription(params.description)
        .buildAttachments(params.attachments);
      const created = await Repository.Reviews().create(review);

      await redisClient.delete(key)

      await ReviewQueueService.getInstance().onReviewCreated({
        reviewId: created.getId().toString(),
        productId: product.getId().toString(),
        storeId: product.convertToSchema().store._id.toString(),
        orderId: params.order,
        userId: userId?.toString(),
        stars: params.stars,
      });

      // const previousAvarageStars = product.getProductStats()?.getAvgStars() ?? 0;
      // const previousCountOfReviews = product.getProductStats()?.getCountOfReviews() ?? 0;
      // const avgStars = Number(((previousAvarageStars * previousCountOfReviews + params.stars) / (previousCountOfReviews + 1)).toFixed(1));

      // let productStats = product.getProductStats();
      // if (!productStats) {
      //   productStats = new ProductStatsEntity()
      // }
      // productStats.buildStarCounts(previousCountOfReviews + 1)
      // productStats.buildCountOfReviews(previousCountOfReviews + 1)
      // productStats.buildAvgStars(avgStars)

      // product.buildProductStats(productStats.convertToSchema())
      // await Repository.Products().update(product);
      // const order = await Repository.Orders().getById(new Types.ObjectId(params.order));
      // if (order) {
      //   const storeOrders = await Repository.StoreOrders().list({}, { orderId: order.getId() }, {});
      //   for (const storeOrder of storeOrders) {
      //     storeOrder.getItems().forEach((item: OrderItemEntity) => {
      //       if (item.getProductId().toString() === product.getId().toString()) {
      //         item.buildIsReviewed(true)
      //       }
      //     })
      //     await Repository.StoreOrders().update(storeOrder);
      //   }
      //   await Repository.Orders().update(order);
      // }
      // const productAwaitingUserReview = (await Repository.ProductsAwaitingUserReviews().list({}, { user: new Types.ObjectId(userId), product: new Types.ObjectId(product.getId()), order: new Types.ObjectId(order.getId()) }, {}))[0];
      // if (productAwaitingUserReview) {
      //   productAwaitingUserReview.buildStatus(ProductsAwaitingUserReviewsStatusEnum.SUBMITTED)
      //   await Repository.ProductsAwaitingUserReviews().update(productAwaitingUserReview);
      // }

      // const tgMessageSender = new TelegramMessageSender();
      // const message = WriteReviewToProductController.reportMessageFormatter(product.getName().getRu(), params, context.client);
      // tgMessageSender.sendMessageToTopic(message, Number(process.env.TG_PRODUCT_REVIEWS_TOPIC));

      return context.send.data({ created: true, id: created.getId().toString() });
    } catch (error) {
      return context.send.error(error);
    }
  }

  static reportMessageFormatter(productName: string, params: WriteReviewParams, user: UserEntity) {
    const message = `📦 <b>Продукт:</b> ${productName}\n⭐️ <b>Звездочка:</b> ${params.stars}\n💬 <b>Описание:</b> ${
      params.description
    }\n\n👨‍🔧 <b>Пользователь:</b> ${user.getUserInfo().getFirstname()} - ${user.getPhoneNumber()}`;
    return message;
  }
}
