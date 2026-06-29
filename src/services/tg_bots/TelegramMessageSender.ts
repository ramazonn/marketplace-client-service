import { PaymentTypeEnum, PromoCodeTypeEnum } from '@ubaytools/core';
import axios from 'axios';
import * as FormData from 'form-data';
import { isPromise } from 'util/types';
import * as XLSX from 'xlsx';

export interface OrderDetailTGBotSenderParamsInterface {
  isPreOrder: boolean;
  orderCode: string;
  customerName: string;
  manager: string;
  clientPhoneNumber: string;
  deliveryAddressType: string;
  shippingAddress: { address: string, mapLink: string };
  urgentDelivery: boolean;
  paymentType: PaymentTypeEnum;
  promoCodeData:{
    code: string;
    type: PromoCodeTypeEnum;
    value: number;
    discountAmount: number;
  };
  totalSum: number;
  products: Array<{ name: string; quantity: number; price: number; discountPercent: number; finalPrice: number; barcode: string }>;
  paidFromCashback: number;
  paid: boolean
}

export class TelegramMessageSender {
  async sendMessage(orderDetail: OrderDetailTGBotSenderParamsInterface): Promise<void> {
    try {
      const message = this.getFormattedMessage(orderDetail);

      const url = `https://api.telegram.org/bot${process.env.TG_REPORTS_BOT_TOKEN}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: process.env.TG_REPORTS_GROUP_ID,
        text: message,
        parse_mode: 'HTML',
      });

    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
    }
  }

  async sendMessageToTopic(message: string, topic_id:number): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${process.env.TG_REPORTS_BOT_TOKEN}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: process.env.TG_REPORTS_GROUP_ID,
        text: message,
        message_thread_id:topic_id,
        parse_mode: 'HTML',
      });

    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
    }
  }

  async sendOrderReportExcelDocument(orderDetail: OrderDetailTGBotSenderParamsInterface): Promise<void> {
    try {
      const message = this.getFormattedMessage(orderDetail);
      const url = `https://api.telegram.org/bot${process.env.TG_REPORTS_BOT_TOKEN}/sendDocument`;

      // Generate Excel file in memory
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(orderDetail.products);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Order Details');

      // Add summary information
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          [],
          ['Заказ', orderDetail.orderCode],
          ['Заказ предварительный', orderDetail.isPreOrder ?'Да':'Нет'],
          ['Имя покупателя', orderDetail.customerName],
          ['Менеджер', orderDetail.manager],
          ['Номер телефона', orderDetail.clientPhoneNumber],
          ['Tип адреса доставки', orderDetail.deliveryAddressType],
          ['Адрес доставки', orderDetail.shippingAddress.address],
          ['Тип оплаты', orderDetail.paymentType],
          ['Промо-код',orderDetail.promoCodeData?`${orderDetail.promoCodeData?.code} - ${orderDetail.promoCodeData?.discountAmount}`:'Нет'],
          ['Общая сумма', orderDetail.totalSum],
          ['Общая сумма, выплаченная из кэшбэка.', orderDetail.paidFromCashback],
        ],
        { origin: -1 },
      );

      // Convert workbook to buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const form = new FormData();
      form.append('chat_id', process.env.TG_REPORTS_GROUP_ID);

      form.append('message_thread_id', orderDetail.paid? process.env.TG_PAYMENT_CONFIRMED_ORDERS_TOPIC:process.env.TG_UNPAID_ORDERS_TOPIC);
      form.append('caption', message);
      form.append('parse_mode', 'HTML');
      form.append('document', excelBuffer, { filename: `order_${orderDetail.orderCode}.xlsx` });

      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
      });

    } catch (error: any) {
      console.error('Error sending message and Excel document:', error.response?.data || error.message);
    }
  }

  private getFormattedMessage(params: OrderDetailTGBotSenderParamsInterface): string {
    const { orderCode, isPreOrder, customerName, manager, clientPhoneNumber, urgentDelivery, deliveryAddressType, shippingAddress, paymentType, promoCodeData, totalSum,paidFromCashback, products } = params;
    const formattedProducts = this.formatProducts(products);

    return (
      `${urgentDelivery?`\n❗️❗️❗️<b>Быстрая доставка</b>❗️❗️❗️\n\n`:``}` +
      `${isPreOrder?`\n❗️❗️❗️<b>Заказ предварительный</b>❗️❗️❗️\n\n`:``}` +
      `<b>🧾 Заказ: ${orderCode}</b>` +
      `\n<b>👨🏻‍💻 Менеджер:</b> ${manager??''}` +
      `\n<b>👨‍🔧 Имя покупателя:</b> ${customerName}` +
      `\n<b>☎️ Номер телефона:</b> ${clientPhoneNumber}` +
      `\n<b>📍 Tип адреса доставки:</b> ${deliveryAddressType }` +
      `\n<b>📍 Адрес доставки:</b> ${shippingAddress.address} - ${shippingAddress.mapLink.length>0?`<a href="${shippingAddress.mapLink}">Карта</a>`:''}` +
      `\n<b>💰 Тип оплаты:</b> ${paymentType}` +
      `\n<b>📦 Продукты и цены:</b>` +
      `\n${formattedProducts}` +
      `\n${promoCodeData?`<b>🏷️ Промо-код:</b> ${promoCodeData?.code} -  ${promoCodeData?.discountAmount} сум `:``}`+
      `\n<b>💸 Общая сумма:</b> ${totalSum} сум` +
      `${paidFromCashback>0?`\n<b>💸 Общая сумма, выплаченная из кэшбэка:</b> ${paidFromCashback} сум\n`:``}`
    );
  }

  private formatProducts(products: Array<{ name: string; quantity: number; price: number;discountPercent: number;finalPrice: number; barcode: string }>): string {
    return products.map((product, index) => `<b>${index + 1}.</b> ` + `${product.barcode ?? ''} ` + `"${product.name}" x <b>${product.quantity}</b>` + `${product.finalPrice!==product.price ? ` <s>${product.price} сум</s> - ${product.discountPercent} % =  ${product.finalPrice} сум` : ` = ${product.price} сум`}`).join('\n');
  }
}
