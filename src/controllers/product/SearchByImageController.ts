import { formData, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CloudFlareService, LanguageEnum, NotFoundError, ProductsModel, ProductStatusEnum, Redis } from '@ubaytools/core';
import * as multer from '@koa/multer';
import OpenAI from 'openai';
import { searchNormalization } from '../../utils/searchNormalization';
import { ImageSearchDayLimitError, ImageSearchMinuteLimitError, ListParams, ProductBasicDetailResponse, SearchByImageParams } from '../../infrastructure';
import { CacheTTLUtil } from '../../utils';
import { Types } from 'mongoose';
import { GetProductDetailUseCase } from '../../usecases';
import { ChatCompletionContentPart } from 'openai/resources/index';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15_000, // 15s — keep below your k8s ingress timeout
    maxRetries: 2,
});

const SESSION_TTL = 60 * 60 * 24; // 24h

@prefix('/product')
export default class SearchByImageController {
    @request('post', '/search-by-image')
    @summary('Search products by image. For pagination send sessionId without image.')
    @security([])
    @tags(['Product'])
    @formData({ file: { type: 'file', required: false, description: 'Product image (required only on first request)' } })
    @query((ListParams as any).swaggerDocument)
    @query((SearchByImageParams as any).swaggerDocument)
    static async controller(context: Context): Promise<void> {
        let listParams: ListParams;
        let params: SearchByImageParams;
        try {
            listParams = await new ListParams(context.request.query).validate();
            params = await new SearchByImageParams(context.request.query).validate();
        } catch (error) {
            const joiError = await context.joi.handle(error);
            return context.send.error(joiError);
        }

        try {
            console.log(context?.ip);

            const start = Date.now()
            const redisClient = await Redis.getInstance();
            const lang = context.lang;
            const { session: sessionId } = params

            let searchTerms: string[];

            if (sessionId) {
                console.log('session');

                // ── Pagination: get searchTerms from session, skip GPT + CDN ──
                const cached = await redisClient.get(`${process.env.NODE_ENV}:image:session:${sessionId}`);
                if (!cached) return context.send.error({ message: 'Session expired. Please search again.' });
                searchTerms = JSON.parse(cached);

            } else {
                console.log('upload');

                await SearchByImageController.checkRateLimit(context, redisClient); // ← here


                // ── First request: image required ─────────────────────────────
                const file = context.file as multer.File | undefined;
                if (!file) return context.send.error({ message: 'Image file is required' });


                // CDN upload + GPT run in parallel
                // const [cdnResult, terms] = await Promise.all([
                //     SearchByImageController.uploadToCDN(file),
                //     SearchByImageController.identifyProduct(file),
                // ]);
                const terms = await SearchByImageController.identifyProduct(file)

                console.log('upload done', Date.now() - start);

                if (!terms.length) throw new NotFoundError('Product');

                searchTerms = terms;

                // Save session for pagination
                const newSessionId = new Types.ObjectId().toString();
                await redisClient.set(
                    `${process.env.NODE_ENV}:image:session:${newSessionId}`,
                    JSON.stringify(searchTerms),
                    SESSION_TTL,
                );

                // Attach sessionId + imageUrl to context for response below
                context.state.sessionId = newSessionId;
                // context.state.imageUrl = cdnResult.url;
            }

            console.log("1.", Date.now() - start, searchTerms);

            const match = {
                $text: { $search: searchTerms.join(' ') },
                status: {
          $in: [ProductStatusEnum.IN_STOCK, ProductStatusEnum.LOW_STOCK],
        },
            };

            const [total, result] = await Promise.all([
                ProductsModel.countDocuments(match),
                ProductsModel.aggregate([
                    { $match: match },
                    { $skip: (listParams.page - 1) * listParams.size },
                    { $limit: listParams.size },
                    { $project: { _id: 1 } },
                ]),
            ]);
            console.log("2.", Date.now() - start, "get ids and total");

            const productIds = result.map((item) => item._id.toString());
            const items = await SearchByImageController.fetchProducts(productIds, lang, start);

            return context.send.data({
                sessionId: context.state.sessionId ?? sessionId,
                // imageUrl: context.state.imageUrl ?? undefined,
                searchTerms,
                total,
                page: listParams.page,
                size: listParams.size,
                items,
            });
        } catch (error) {
            return context.send.error(error);
        }
    }

    private static async checkRateLimit(context: Context, redisClient: any): Promise<void> {
        const userId = context.client?.getId()?.toString() ?? context.ip;

        const minuteKey = `${process.env.NODE_ENV}:image:ratelimit:minute:${userId}`;
        const dayKey = `${process.env.NODE_ENV}:image:ratelimit:day:${userId}`;

        const [minuteCount, dayCount] = await Promise.all([
            redisClient.get(minuteKey),
            redisClient.get(dayKey),
        ]);

        if (parseInt(minuteCount) >= 2) throw new ImageSearchMinuteLimitError();
        if (parseInt(dayCount) >= 5) throw new ImageSearchDayLimitError();


        // Increment both counters
        const pipeline = await redisClient.pipeline();
        pipeline.incr(minuteKey);
        pipeline.expire(minuteKey, 60);        // resets every minute
        pipeline.incr(dayKey);
        pipeline.expire(dayKey, 60 * 60 * 24); // resets every day
        await pipeline.exec();
    }

    private static async fetchProducts(productIds: string[], lang: LanguageEnum, start: number): Promise<any[]> {
        if (!productIds.length) return [];

        const redisClient = await Redis.getInstance();

        const productCacheKeys = productIds.map((productId) => `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`);
        const cachedProductsData = productCacheKeys.length > 0 ? await redisClient.mget(productCacheKeys) : [];
        console.log("3. productCacheKeys", Date.now() - start, productCacheKeys);

        // Process cached products
        const productMap = new Map<string, any>();
        const missingProductIds: Types.ObjectId[] = [];

        for (let i = 0; i < productIds.length; i++) {
            const productId = productIds[i];
            const cachedData = cachedProductsData[i];

            if (cachedData) {
                try {
                    const productData = JSON.parse(cachedData);
                    productMap.set(productId, productData);
                } catch (error) {
                    missingProductIds.push(new Types.ObjectId(productId));
                }
            } else {
                missingProductIds.push(new Types.ObjectId(productId));
            }
        }
        console.log("4. missingProductIds", Date.now() - start, missingProductIds);

        // If some products are missing, fetch them in batch
        if (missingProductIds.length > 0) {
            const batchProductData = await GetProductDetailUseCase.basicDetail(missingProductIds, lang);

            // Cache and add to productMap using pipeline (single Redis call)
            const pipeline = await redisClient.pipeline();
            for (const productId of missingProductIds) {
                const productData = batchProductData.find((product) => product._id.toString() === productId.toString());
                if (productData) {
                    productMap.set(productId.toString(), productData);

                    // Add to pipeline
                    const cacheKey = `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`;
                    const cacheproductTTL = CacheTTLUtil.withRandomTTL(24 * 60 * 60);
                    pipeline.set(cacheKey, JSON.stringify(productData), { EX: cacheproductTTL });
                }
            }
            await pipeline.exec();
            console.log("5. get missingProductIds", Date.now() - start);

        }

        // Build products array in order
        const products = productIds
            .map((productId) => productMap.get(productId))
            .filter((product) => product !== undefined);

        // Build response
        const response = products.map((product) => {
            return new ProductBasicDetailResponse(product, lang);
        });
        console.log("6. formatting response", Date.now() - start);

        return response
    }

    private static async uploadToCDN(file: multer.File): Promise<{ id: string; url: string }> {
        const cloudFlareService = new CloudFlareService();
        const result = await cloudFlareService.uploadImage(file);
        // make image url: result doesn't contain url key itself
        return { id: result.id, url: result.url };
    }

    private static async identifyProduct(file: multer.File): Promise<string[]> {
        console.log('gpt start', Date.now());

        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp';

        const content: ChatCompletionContentPart[] = [
            {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'low' },
            },
            {
                type: 'text',
                text: `Bu O'zbekistondagi qurilish, bog' parvarishi, hunarmandchilik va uyga uchun kerakli asbob uskunalar sotadigan marketpleys.
 
                                Rasmdagi mahsulotni aniqla va qidiruv so'zlarini vergul bilan ajratib qaytar.
                                Faqat vergul bilan ajratilgan so'zlar. Hech qanday izoh, hech qanday qavs bo'lmasin.
                                O'zingdan qo'shimcha qo'shma.
                                
                                QOIDALAR:
                                - 8-10 ta qidiruv so'zi qaytar
                                - o'zbekcha shevaga oid keng tarqalgan nom: 2ta lotin va 2ta kiril harflarida
                                - ruscha nom: 2ta (ko'p o'zbeklar ruscha ishlatadi)
                                - qisqa va aniq mahsulot nomi: 2ta (qurilish, asbob, beton kabi umumiy so'zlardan foydalanma)
                                - agar rasmda mahsulot brendi aniq ko'rinsa uni ham 1ta lotin va 1ta kiril harflari bilan qaytar: o'zingdan tahmin qilma
                                - Agar mahsulot qurilish, bog' yoki asbob kategoriyasiga kirmasa: UNRELATED qaytar
                                - HECH QACHON quyidagi umumiy so'zlarni qaytarma — ular barcha mahsulotlarga tushadi:
                                    qurilish, asbob, uskuna, elektr, elektrik, mahsulot, material, jihozlar,
                                    qo'lda, ishlash, teshish, kesish, burg'ulash, parmalash, qurish, o'rnatish, beton
                                    строительство, инструмент, оборудование, электрический, материал, работа,
                                    construction, tool, equipment, electric, material, machine, device
                                
                                MISOL - Bolgarka:
                                bolgarka,bolgarqa,болгарка,болгарча,угловая шлифмашина,шлифмашина,grinder,shlifmashina
                                
                                MISOL - Perforator:
                                perforator,perforatar,перфоратор,перфаратор,перфоратор ударный,буровая машина,perforator,перфоратор
                                
                                MISOL - Shurpavyort:
                                shurpavyort,shurupchi,шуруповёрт,шурупчи,шуруповёрт аккумуляторный,дрель-шуруповёрт,shurpavyort,шуруповёрт
                                
                                MISOL - O't o'rgich:
                                gazonokosилka,o't o'rgich,газонокосилка,ўт ўргич,газонокосилка электрическая,косилка для травы,gazonokosилka,газонокосилка
                                
                                MISOL - Shlang:
                                shlang,shlangi,шланг,шланги,шланг поливочный,садовый шланг,shlang,шланг
                                
                                MISOL - Arra:
                                arra,arrasi,пила,арра,пила электрическая,циркулярная пила,arra,пила
                                
                                MISOL - Telefon:
                                UNRELATED`,
            },
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 100,
            messages: [{ role: 'user', content }],
        });

        const raw = response.choices[0].message.content?.trim() ?? '';
        if (!raw || raw.toUpperCase() === 'UNRELATED') return [];
        console.log('gpt done', Date.now());

        return raw
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 2);
    }
}