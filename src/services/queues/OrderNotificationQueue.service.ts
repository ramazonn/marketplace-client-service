import { BullQueueFactory } from '@ubaytools/core';
import { Queue } from 'bullmq';

interface OrderNotificationQueueData {
  id: string;
}

export class OrderNotificationQueueService {
  private static instance: OrderNotificationQueueService;

  private queueFactory: BullQueueFactory<OrderNotificationQueueData, void>;
  private queue: Queue<OrderNotificationQueueData, void> | null = null;

  private readonly queueName: string;

  private constructor() {
    const envPrefix = process.env.NODE_ENV || 'dev';

    this.queueName = `${envPrefix}-order-notification-queue`;

    this.queueFactory = new BullQueueFactory<OrderNotificationQueueData, void>(this.queueName);
  }

  static getInstance(): OrderNotificationQueueService {
    if (!OrderNotificationQueueService.instance) {
      OrderNotificationQueueService.instance = new OrderNotificationQueueService();
    }

    return OrderNotificationQueueService.instance;
  }

  private async getQueue(): Promise<Queue<OrderNotificationQueueData, void>> {
    if (!this.queue) {
      this.queue = await this.queueFactory.createQueue();
    }

    return this.queue;
  }

  async publishOrderTelegramNotification(id: string, jobName: string): Promise<void> {
    try {
      const queue = await this.getQueue();

      await queue.add(jobName, {
        id,
      });
    } catch (error) {
      console.error('Error in publishOrderTelegramNotification', error);
    }
  }
}
