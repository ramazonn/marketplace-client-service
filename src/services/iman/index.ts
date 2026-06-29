import { OrderEntity, OrderItemEntity } from '@ubaytools/core';
import axios, { AxiosInstance } from 'axios';
import { Cookie, CookieJar } from 'tough-cookie';
import * as https from 'https';

export class ImanService {
    static instance: ImanService;
    static url = process.env.IMAN_URL;

    private jar: CookieJar;        // ✅ instance-level, not module-level (was leaking before)
    private client: AxiosInstance; // ✅ shared axios instance with connection reuse

    private constructor() {
        this.jar = new CookieJar(); // ✅ scoped to singleton instance, not module
        this.client = axios.create({
            baseURL: ImanService.url,
            timeout: 10000, // ✅ 10s timeout — prevents hanging requests from holding memory
            httpsAgent: new https.Agent({
                keepAlive: true,   // ✅ reuse TCP connections instead of creating new ones per request
                maxSockets: 10,    // ✅ cap concurrent connections to Iman
                maxFreeSockets: 5, // ✅ keep up to 5 idle sockets in pool
            }),
        });
    }

    static getInstance(): ImanService {
        if (!ImanService.instance) {
            ImanService.instance = new ImanService();
        }
        return ImanService.instance;
    }

    async login(): Promise<any> {
        try {
            const body = {
                username: process.env.IMAN_USERNAME,
                password: process.env.IMAN_PASSWORD,
            };

            const response = await this.client.post('/v1/auth/login', body); // ✅ use shared client
            const access_token_ttl = response?.data?.access_token_ttl ?? 3600 * 1000;
            const refresh_token_ttl = response?.data?.refresh_token_ttl ?? 120 * 1000;

            // ✅ use this.jar instead of module-level jar
            this.jar.setCookieSync(
                `access_token=${response.data.access_token}; Path=/`,
                ImanService.url
            ).setExpires(new Date(Date.now() + access_token_ttl));

            this.jar.setCookieSync(
                `refresh_token=${response.data.refresh_token}; Path=/`,
                ImanService.url
            ).setExpires(new Date(Date.now() + refresh_token_ttl));

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async refreshToken(refresh_token: string): Promise<any> {
        try {
            const body = { refresh_token };

            const response = await this.client.post('/v1/auth/refresh-token', body); // ✅ use shared client
            const access_token_ttl = response?.data?.access_token_ttl ?? 3600 * 1000;
            const refresh_token_ttl = response?.data?.refresh_token_ttl ?? 120 * 1000;

            // ✅ use this.jar instead of module-level jar
            this.jar.setCookieSync(
                `access_token=${response.data.access_token}; Path=/`,
                ImanService.url
            ).setExpires(new Date(Date.now() + access_token_ttl));

            this.jar.setCookieSync(
                `refresh_token=${response.data.refresh_token}; Path=/`,
                ImanService.url
            ).setExpires(new Date(Date.now() + refresh_token_ttl));

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async getAccessToken(): Promise<string> {
        try {
            // ✅ use this.jar instead of module-level jar
            const cookies = this.jar.getCookiesSync(ImanService.url);
            let result: string | null = null;

            const access_token: Cookie = cookies.find((cookie: any) => cookie?.key === 'access_token');

            if (!access_token) {
                const refresh_token: Cookie = cookies.find((cookie: any) => cookie?.key === 'refresh_token');
                if (!refresh_token) {
                    const loginResponse = await this.login();
                    result = loginResponse?.access_token;
                } else {
                    const refreshResponse = await this.refreshToken(refresh_token.value);
                    result = refreshResponse?.access_token;
                }
            } else {
                result = access_token.value;
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    async createBasket(order: OrderEntity): Promise<any> {
        try {
            const access_token = await this.getAccessToken();
            const items: any[] = [];

            order.getItems().forEach((item: OrderItemEntity) => {
                const quantity = item.getQuantity();
                for (let i = 0; i < quantity; i++) {
                    items.push({
                        barcode: item.getBarcode(),
                        category: item.getProductName().getUz(),
                        mark_kiz: '',
                        merchant_product_id: item.getProductId().toString(),
                        model: item.getBrand(),
                        name: item.getProductName().getUz(),
                        price: item.getFinalPrice(),
                        quantity: 1,
                        spic: '10701001012000000',
                    });
                }
            });

            const body = {
                client_phone: order.getUserData()?.getPhoneNumber() ?? '',
                external_order_id: order.getOrderCode().toString() ?? '',
                items,
            };

            const response = await this.client.post('/v1/baskets/create-qr', body, { // ✅ use shared client
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            });

            return response.data;
        } catch (error) {
            console.error('ImanService.createBasket error:', error?.response?.data?.errors);
            throw error;
        }
    }

    async calculatePurchaseOptions(totalAmount: number): Promise<any> {
        try {
            const access_token = await this.getAccessToken();

            const body = { total_amount: totalAmount };

            const response = await this.client.post('/v1/products/calculate-purchase-options', body, { // ✅ use shared client
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            });

            return response.data;
        } catch (error) {
            console.error('ImanService.calculatePurchaseOptions error:', error?.response?.data?.errors);
            throw error;
        }
    }
}