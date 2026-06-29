import { BullQueueFactory } from '@ubaytools/core';
import { Queue } from 'bullmq';
import { TelegramMessageSender } from '../tg_bots';

/**
 * OrderQueue service for publishing order created events to BullMQ.
 * Uses BullQueueFactory from @ubaytools/core to create and manage the queue.
 * 
 * The queue name follows the pattern: {NODE_ENV}-order-created-queue
 * Jobs are consumed by the integrations-api service workers.
 */
export class WelcomeBonusQueueService {
  private static instance: WelcomeBonusQueueService;
  private queueFactory: BullQueueFactory<{userId: string}, void>;
  private queue: Queue<{userId: string}, void> | null = null;
  private readonly queueName: string;

  private constructor() {
    const envPrefix = process.env.NODE_ENV || 'dev';
    this.queueName = `${envPrefix}-welcome-bonus-operations-queue`;
    this.queueFactory = new BullQueueFactory<{userId: string}, void>(this.queueName);
  }

  /**
   * Get singleton instance of WelcomeBonusQueueService
   */
  static getInstance(): WelcomeBonusQueueService {
    if (!WelcomeBonusQueueService.instance) {
      WelcomeBonusQueueService.instance = new WelcomeBonusQueueService();
    }
    return WelcomeBonusQueueService.instance;
  }

  /**
   * Get or create the BullMQ queue instance
   */
  private async getQueue(): Promise<Queue<{userId: string}, void>> {
    if (!this.queue) {
      this.queue = await this.queueFactory.createQueue();
    }
    return this.queue;
  }

 async publishToQueue(userId: string): Promise<void> {
    try {
        const queue = await this.getQueue();
      
        const jobName = 'send-welcome-bonus';
        const job = await queue.add(jobName, { userId });
       
    } catch (error) {
        console.error('Error in publishToQueue', error);
    }
  }
}