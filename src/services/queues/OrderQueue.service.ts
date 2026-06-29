import { BullQueueFactory } from '@ubaytools/core';
import { Queue } from 'bullmq';
import { TelegramMessageSender } from '../tg_bots/TelegramMessageSender';

/**
 * OrderQueue service for publishing order created events to BullMQ.
 * Uses BullQueueFactory from @ubaytools/core to create and manage the queue.
 * 
 * The queue name follows the pattern: {NODE_ENV}-order-created-queue
 * Jobs are consumed by the integrations-api service workers.
 */
export class OrderQueueService {
  private static instance: OrderQueueService;
  private queueFactory: BullQueueFactory<{orderId: string}, void>;
  private queue: Queue<{orderId: string}, void> | null = null;
  private readonly queueName: string;

  private constructor() {
    const envPrefix = process.env.NODE_ENV || 'dev';
    this.queueName = `${envPrefix}-order-operations-queue`;
    this.queueFactory = new BullQueueFactory<{orderId: string}, void>(this.queueName);
  }

  /**
   * Get singleton instance of OrderQueueService
   */
  static getInstance(): OrderQueueService {
    if (!OrderQueueService.instance) {
      OrderQueueService.instance = new OrderQueueService();
    }
    return OrderQueueService.instance;
  }

  /**
   * Get or create the BullMQ queue instance
   */
  private async getQueue(): Promise<Queue<{orderId: string}, void>> {
    if (!this.queue) {
      this.queue = await this.queueFactory.createQueue();
    }
    return this.queue;
  }

 async publishCreatedOrderToQueue(orderId: string): Promise<void> {
    try {
        const queue = await this.getQueue();
      
        const jobName = 'created-order';
        const job = await queue.add(jobName, { orderId });
        const tgMessageSender = new TelegramMessageSender();
        const message = `Job added to queue: ${job.id} 📣\nOrder id: ${orderId}`;
        await tgMessageSender.sendMessageToTopic(message,Number(process.env.TG_MQ_JOB_REPORTS_TOPIC));
       
    } catch (error) {
        console.error('Error in publishCreatedOrderToQueue', error);
    }
  }
}