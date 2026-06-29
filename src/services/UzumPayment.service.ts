// order service, e.g. integrations/UzumService.ts
import { OrderItemSchema } from '@ubaytools/core';
import axios from 'axios';

export class UzumService {
  private orderCode: string;
  private totalAmount: number;
  private user: { id: string; phoneNumber: string; lang: 'uz' | 'ru' | 'en' };
  private items: any[];

  constructor(params: {
    orderCode: string;
    totalAmount: number;
    user: { id: string; phoneNumber: string; lang: 'uz' | 'ru' | 'en' };
    items: OrderItemSchema[];
  }) {
    this.orderCode = params.orderCode;
    this.totalAmount = params.totalAmount;
    this.user = params.user;
    this.items = params.items;
  }

  async paymentRegister(): Promise<any> {
    const paymentRegisterParams = {
      orderCode: this.orderCode,
      totalAmount: this.totalAmount,
      user: this.user,
      items: this.items,
    };
    const response = await axios.post(process.env.INTEGRATION_API_URL + '/uzum/payment/register', paymentRegisterParams, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${process.env.INTEGRATION_API_TOKEN}`,
      },
    });
    return response.data;
  }
}