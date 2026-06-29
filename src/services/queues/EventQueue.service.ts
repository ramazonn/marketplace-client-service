import { BullQueueFactory } from '@ubaytools/core';
import { Queue } from 'bullmq';

export interface TrackEventPayload {
    userId: string;
    eventType: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export class EventQueueService {
    private static instance: EventQueueService;
    private queueFactory: BullQueueFactory<TrackEventPayload, void>;
    private queue: Queue<TrackEventPayload, void> | null = null;
    private readonly queueName: string;

    private constructor() {
        const envPrefix = process.env.NODE_ENV || 'development';
        this.queueName = `${envPrefix}-event-tracking-queue`;
        this.queueFactory = new BullQueueFactory<TrackEventPayload, void>(this.queueName);
    }

    static getInstance(): EventQueueService {
        if (!EventQueueService.instance) {
            EventQueueService.instance = new EventQueueService();
        }
        return EventQueueService.instance;
    }

    private async getQueue(): Promise<Queue<TrackEventPayload, void>> {
        if (!this.queue) {
            this.queue = await this.queueFactory.createQueue();
        }
        return this.queue;
    }

    async publishToQueue(payload: TrackEventPayload): Promise<void> {
  try {
    const queue = await this.getQueue();

    // console.log('EVENT QUEUE SEND:', payload);

    const job = await queue.add(payload.eventType, payload);

    // console.log('EVENT JOB ADDED:', {
    //   id: job.id,
    //   name: job.name,
    //   queueName: this.queueName,
    // });
  } catch (error) {
    console.error('Error in EventQueueService.publishToQueue', error);
  }
}
}