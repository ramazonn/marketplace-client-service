import { prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { ProductReviewListParams } from '../../infrastructure';
import { CloudFlareService, Redis, Repository, ReviewsEntity, ReviewsModel, UserEntity } from '@ubaytools/core';
import { Types } from 'mongoose';
import { CacheTTLUtil } from '../../utils';

class ProductReviewListItemResponse {
  id: string;
  stars: number;
  advantages: string;
  disadvantages: string;
  description: string;
  createdAt: Date;
  user: { id: string; fullname: string; phoneNumber: string; avatar: string };
  answer: string;
  attachments: string[];
  constructor(review: ReviewsEntity) {
    this.id = review.getId().toString();
    this.advantages = review.getAdvantages() ?? null;
    this.disadvantages = review.getDisadvantages() ?? null;
    this.description = review.getDescription() ?? null;
    this.stars = review.getStars() ?? null;
    this.createdAt = review.getCreatedAt() ?? null;
    const user = review.getUser() as UserEntity;
    if (user) {
      let fullname = '';
      if (user.getUserInfo()?.getLastname()) fullname += user.getUserInfo().getLastname();
      if (user.getUserInfo()?.getFirstname()) fullname += ' ' + user.getUserInfo()?.getFirstname();
      this.user = user
        ? {
            id: user.getId().toString(),
            fullname: fullname,
            phoneNumber: user.getPhoneNumber(),
            avatar: user.getUserInfo()?.getAvatar() ? CloudFlareService.getImageUrlByFileID(user.getUserInfo().getAvatar()) : null,
          }
        : null;
      this.answer = review.getAnswer() ?? null;
    }
    this.answer = review.getAnswer() ?? null;
    this.attachments = review.getAttachments() ?? null;
  }
}

@prefix('/review')
export default class GetReviewListByProductController {
  @request('get', '/by-product')
  @summary('Product reviews')
  @security([])
  @tags(['Review'])
  @query((ProductReviewListParams as any).swaggerDocument)
  static async controller(context: Context): Promise<void> {
    let params: ProductReviewListParams;
    try {
      params = await new ProductReviewListParams(context.request.query).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const filter = {};
      filter['product'] = new Types.ObjectId(params.product);
      const redisClient = await Redis.getInstance();
      const cacheKey = `${process.env.NODE_ENV}:product:${params.product}:reviews:list:page:${params.page}:size:${params.size}`;

      const cachedResult = await redisClient.get(cacheKey);

      if (cachedResult) {
        return context.send.data(JSON.parse(cachedResult));
      }

      const items = await Repository.Reviews().list({ page: params.page, size: params.size }, filter, { createdAt: -1 });

      const total = await Repository.Reviews().countDocumentsByFilter(filter);
      const response = items.map((item) => new ProductReviewListItemResponse(item));

      const result = { total: total, items: response };

      const cacheResultTTL =  CacheTTLUtil.withRandomTTL(3600);
      await redisClient.set(cacheKey, JSON.stringify(result), cacheResultTTL);

      // const [starCounts] = await GetReviewListByProductController.starsCounts(filter);
      return context.send.data(result);
    } catch (error) {
      return context.send.error(error);
    }
  }

  static async starsCounts(filter: any) {
    const aggregationPipeline = [
      { $match: filter },
      {
        $group: {
          _id: { $trunc: '$stars' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$count' },
          starCounts: {
            $push: {
              k: { $toString: '$_id' },
              v: '$count',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          total: 1,
          stars: { $arrayToObject: '$starCounts' },
        },
      },
    ];

    return ReviewsModel.aggregate(aggregationPipeline);
  }
}
