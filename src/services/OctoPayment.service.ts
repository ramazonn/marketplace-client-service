import axios from 'axios';
import * as moment from 'moment';

export enum OctoPaymentStatus {
  CREATED = 'created',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
  WAIT_USER_ACTION = 'wait_user_action',
  WAITING_FOR_CAPTURE = 'waiting_for_capture',
}

export class OctoService {
  private orderCode: string;
  private totalAmount: number;
  private user: { id: string; phoneNumber: string; lang: 'uz' | 'ru' | 'en' };
  constructor(params: { orderCode: string; totalAmount: number; user: { id: string; phoneNumber: string; lang: 'uz' | 'ru' | 'en' } }) {
    this.orderCode = params.orderCode;
    this.totalAmount = params.totalAmount;
    this.user = params.user;
  }

  async preparePayment(): Promise<any> {
    const prepareParams = {
      orderCode: this.orderCode,
      totalAmount: this.totalAmount,
      user: this.user,
    };
    const response = await axios.post(process.env.INTEGRATION_API_URL + '/octo/pay', prepareParams, {
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${process.env.INTEGRATION_API_TOKEN}` },
    });
    return response.data;
  }
}
