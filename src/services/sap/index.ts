import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';
import * as moment from "moment"
const jar = new CookieJar();

axios.defaults.httpAgent = new HttpCookieAgent({
  cookies: { jar },
  keepAlive: true,
});
axios.defaults.httpsAgent = new HttpsCookieAgent({
  cookies: { jar },
  keepAlive: true,
  rejectUnauthorized: false, // disable CA checks
});

axios.defaults.timeout = 10000;

axios.defaults.headers.common = {
  'User-Agent': 'HTTPie/2.3.0',
  Accept: '*/*',
};
import { BaseCaseParamsInterface, DeliveryAddressTypeEnum, OrderEntity, OrderItemEntity, sliceLogParams } from '@ubaytools/core';

export class SAPService {
  static instance: SAPService;
  private constructor() {}

  static getInstance(): SAPService {
    if (!SAPService.instance) {
      SAPService.instance = new SAPService();
    }
    return SAPService.instance;
  }

  static url = process.env.SAP_URL;

  async login(params: BaseCaseParamsInterface<{}>): Promise<any> {
        try {
            const { refId, client } = sliceLogParams(params);
            const body = {
                CompanyDB: process.env.SAP_COMPANY_DB,
                UserName: process.env.SAP_USERNAME,
                Password: process.env.SAP_PASSWORD,
            };
            console.log('Login attempt');
            const response = await axios.post(`${SAPService.url}/Login`, body);
            return response.data;
        } catch (error) {
            throw error;
        };
    }

    // this is not real order, this is only reservation: it called order in Sap
    async reserve(order:OrderEntity,tried: boolean = false) {
        try {
            // const { refId, client } = sliceLogParams(params);
            let dueDate = moment().toDate()
            if (order.getDeliveryAddressType() == DeliveryAddressTypeEnum.LOCATION) {
                dueDate = moment().add(1, 'd').toDate()
            } else if (order.getDeliveryAddressType() == DeliveryAddressTypeEnum.UBAY_POINT) {
                dueDate = moment().add(3, 'd').toDate()
                
            }else if (order.getDeliveryAddressType() == DeliveryAddressTypeEnum.DELIVERY_POINT) {
                dueDate = moment().add(7, 'd').toDate()
                
            }

            const items = order.getItems()?.map(item => {
                return {
                    ItemCode: item.getItemCode(),
                    Quantity: item.getQuantity(),
                    UnitPrice: item.getFinalPrice(),  // price: actual sold price
                    WarehouseCode: item.getWarehouseCode()
                };
                
             })

            const body = {
                DocDate: moment().toDate(),  // createdAt
                DocDueDate: dueDate,  //  Delivery time (tahminan)
                CardCode: "MARKETPLACE",  // don't change it
                NumAtCard: order.getOrderCode(),  //  orderCode
                DocCurrency: "UZS",  // don't change it
                SalesPersonCode: 1,  // manager id. SalesPerson.SalesEmployeeCode
                DocumentLines: items
            };
            const response = await axios.post(`${SAPService.url}/Orders`, body);
            return response.data;
          } catch (error) {
            if (!tried && error?.response?.data?.error?.code == 301) {
                await this.login({});
                return await this.reserve(order, true);
              }
            throw error;
          }
    }

    // this is real order: it is called invoce in Sap
    async order(order:OrderEntity,tried: boolean = false) {
        try {
            // const { refId, client } = sliceLogParams(params);
            let dueDate = moment().toDate()
            if (order.getDeliveryAddressType() == DeliveryAddressTypeEnum.LOCATION) {
                dueDate = moment().add(1, 'd').toDate()
            } else if (order.getDeliveryAddressType() == DeliveryAddressTypeEnum.UBAY_POINT) {
                dueDate = moment().add(3, 'd').toDate()
                
            }else if (order.getDeliveryAddressType() == DeliveryAddressTypeEnum.DELIVERY_POINT) {
                dueDate = moment().add(7, 'd').toDate()
                
            }

            const items = [
                {
                    "ItemCode": "bolgarka",
                    "Quantity": 2,
                    "UnitPrice": 100000,
                    "WarehouseCode": "02",
                    "BaseEntry": 112,  // Buyurtma id-si. Order.DocEntry
                    "BaseLine": 0,  // Buyurtmada nechanchi mol. Order.DocumentLines.LineNum
                    "BaseType": 17  // Shunday tursin
                },
                {
                    "ItemCode": "bolgarka2",
                    "Quantity": 3,
                    "UnitPrice": 80000,
                    "WarehouseCode": "01",
                    "BaseEntry": 112,
                    "BaseLine": 1,
                    "BaseType": 17
                }
            ];

            const body = {
                DocDate: moment().toDate(),  // createdAt
                DocDueDate: dueDate,  //  Delivery time (tahminan)
                CardCode: "MARKETPLACE",  // don't change it
                NumAtCard: order.getOrderCode(),  //  orderCode
                DocCurrency: "UZS",  // don't change it
                SalesPersonCode: 1,  // manager id. SalesPerson.SalesEmployeeCode
                DocumentLines: items
            };
            const response = await axios.post(`${SAPService.url}/Invoices`, body);
            return response.data;
          } catch (error) {
            if (!tried && error?.response?.data?.error?.code == 301) {
                await this.login({});
                return await this.order(order, true);
              }
            throw error;
          }
    }

}
