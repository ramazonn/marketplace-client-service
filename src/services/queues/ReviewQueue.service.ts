import { BullQueueFactory } from '@ubaytools/core';
import { Queue } from 'bullmq';

type ReviewJob = {
  reviewId: string;
  productId: string;
  storeId?: string;
  orderId?: string;
  userId?: string;
  stars: number;
};

export class ReviewQueueService {
  private static instance: ReviewQueueService;
  private queueFactory: BullQueueFactory<ReviewJob, void>;
  private queue: Queue<ReviewJob, void> | null = null;
  private readonly queueName: string;

  private constructor() {
    const env = process.env.NODE_ENV || 'dev';
    this.queueName = `${env}-review-queue`;
    this.queueFactory = new BullQueueFactory<ReviewJob, void>(this.queueName);
  }

  static getInstance(): ReviewQueueService {
    if (!this.instance) {
      this.instance = new ReviewQueueService();
    }
    return this.instance;
  }

  private async getQueue() {
    if (!this.queue) {
      this.queue = await this.queueFactory.createQueue();
    }
    return this.queue;
  }

  async onReviewCreated(data: ReviewJob) {
    const queue = await this.getQueue();

    await queue.add('review-created', data);

    console.log('[ReviewQueue] job added');
  }
}
