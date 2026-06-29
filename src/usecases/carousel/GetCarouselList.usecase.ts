import { Types } from 'mongoose';
import { CarouselEntity, CarouselProductEntity, CarouselStatusEnum, LanguageEnum, ProductEntity, Redis, Repository } from '@ubaytools/core';
import { GetProductDetailUseCase } from '../product/GetProductDetail.usecase';
import { ProductBasicDetailResponse } from '../../infrastructure';

  export class GetCarouselListUseCase {
    static async execute(page: number, size: number, lang: LanguageEnum, userId?: string) {
      const redisClient = await Redis.getInstance();
      const start = Date.now();
      // Get carousel count
      let count: any = await redisClient.get(`${process.env.NODE_ENV}:carousel:count`);
      if (count) count = parseInt(count);
      if (!count) {
        count = await Repository.Carousels().countDocumentsByFilter({});
        await redisClient.set(`${process.env.NODE_ENV}:carousel:count`, count.toString(), 24 * 60 * 60);
      }
  
      // Get carousel list basic data
      let carouselBasicList: any = await redisClient.get(`${process.env.NODE_ENV}:carousel:list:basic:${page}:${size}:${lang}`);
      if (carouselBasicList) carouselBasicList = JSON.parse(carouselBasicList);
      if (!carouselBasicList) {
        const carousels = await Repository.Carousels().list({ page, size });
        carouselBasicList = carousels.map((carousel) => ({
          id: carousel.getId().toString(),
          title: carousel.getTitle()?.getByLang(lang) ?? null,
          status: carousel.getStatus(),
          productCount: carousel.getProducts().length,
        }));
        await redisClient.set(`${process.env.NODE_ENV}:carousel:list:basic:${page}:${size}:${lang}`, JSON.stringify(carouselBasicList), 24 * 60 * 60);
      }

      // Batch get all carousel caches at once (single Redis call)
      const carouselCacheKeys = carouselBasicList.map((carouselBasic) => `${process.env.NODE_ENV}:carousel:${carouselBasic.id}:${lang}`);
      const cachedCarouselsData = await redisClient.mget(carouselCacheKeys);
      // Process carousel caches and identify missing ones
      const carouselProductIdsMap = new Map<string, string[]>();
      const allProductIds: string[] = [];
      const missingCarouselIds: string[] = [];
      const carouselCacheToSet: Array<{ key: string; value: string }> = [];

      for (let i = 0; i < carouselBasicList.length; i++) {
        const carouselBasic = carouselBasicList[i];
        const cachedData = cachedCarouselsData[i];
        let productIds: string[] = [];

        if (cachedData) {
          try {
            const carouselData = JSON.parse(cachedData);
            productIds = carouselData.productIds || [];
          } catch (error) {
            // Parse error, treat as missing
            missingCarouselIds.push(carouselBasic.id);
          }
        } else {
          missingCarouselIds.push(carouselBasic.id);
        }

        // If missing, we'll fetch from DB
        if (!productIds || productIds.length === 0) {
          missingCarouselIds.push(carouselBasic.id);
        } else {
          carouselProductIdsMap.set(carouselBasic.id, productIds);
          allProductIds.push(...productIds);
        }
      }
      // Fetch missing carousels from DB in parallel
      if (missingCarouselIds.length > 0) {
        const carouselPromises = missingCarouselIds.map(async (carouselId) =>
          await Repository.Carousels().getById(new Types.ObjectId(carouselId))
        );
        const missingCarousels = await Promise.all(carouselPromises);
        for (const carousel of missingCarousels) {
          const carouselId = carousel.getId().toString();
          const productIds = carousel.getProducts().map((cp: CarouselProductEntity) => cp.getProduct().toString());
          
          carouselProductIdsMap.set(carouselId, productIds);
          allProductIds.push(...productIds);

          const carouselData = {
            id: carouselId,
            title: carousel.getTitle()?.getByLang(lang) ?? null,
            status: carousel.getStatus(),
            productIds: productIds,
            productCount: productIds.length,
          };
          const carouselCacheKey = `${process.env.NODE_ENV}:carousel:${carouselId}:${lang}`;
          carouselCacheToSet.push({
            key: carouselCacheKey,
            value: JSON.stringify(carouselData),
          });
        }

        // Batch set carousel caches using pipeline
        if (carouselCacheToSet.length > 0) {
          const pipeline = await redisClient.pipeline();
          for (const item of carouselCacheToSet) {
            pipeline.set(item.key, item.value, { EX: 24 * 60 * 60 });
          }
          await pipeline.exec();
        }
      }
      // Remove duplicates
      const uniqueProductIds = Array.from(new Set(allProductIds));
      // Batch get all product caches at once (single Redis call)
      const cacheKeys = uniqueProductIds.map((productId) => `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`);
      const cachedProductsData = await redisClient.mget(cacheKeys);
  
      // Process cached products
      const productMap = new Map<string, ProductBasicDetailResponse>();
      let missingProductIds: Types.ObjectId[] = [];
  
      for (let i = 0; i < uniqueProductIds.length; i++) {
        const productId = uniqueProductIds[i];
        const cachedData = cachedProductsData[i];
  
        if (cachedData) {
          try {
            const productData = JSON.parse(cachedData);
            const product = new ProductBasicDetailResponse(productData, lang);
            // product.isFavorite = false;
            productMap.set(productId, product);
          } catch (error) {
            // If parsing fails, treat as missing
            missingProductIds.push(new Types.ObjectId(productId));
          }
        } else {
          missingProductIds.push(new Types.ObjectId(productId));
        }
      }
      // If some products are missing, fetch them in batch
      if (missingProductIds.length > 0) {       
        const batchProductData = await GetProductDetailUseCase.basicDetail(missingProductIds, lang);
        // Cache and add to productMap using pipeline (single Redis call)
        const pipeline = await redisClient.pipeline();
        for (const productId of missingProductIds) {
          const productData = batchProductData.find((product) => product._id.toString() === productId.toString());
          if (productData) {  
            const product = new ProductBasicDetailResponse(productData, lang);
            productMap.set(productId.toString(), product);

            // Add to pipeline
            const cacheKey = `${process.env.NODE_ENV}:product:basic:${productId.toString()}:${lang}`;
            pipeline.set(cacheKey, JSON.stringify(productData), { EX: 24 * 60 * 60 });
          }
        }
        
        await pipeline.exec();
      }
  
      // Build response
      const response = carouselBasicList.map((carouselBasic) => {
        const productIds = carouselProductIdsMap.get(carouselBasic.id) || [];
        const products = productIds
          .map((productId) => productMap.get(productId))
          .filter((product): product is ProductBasicDetailResponse => product !== undefined);
  
        const carouselEntity = {
          getId: () => new Types.ObjectId(carouselBasic.id),
          getTitle: () => ({
            getByLang: (lang: LanguageEnum) => carouselBasic.title,
          }),
          getStatus: () => carouselBasic.status,
        } as any as CarouselEntity;
  
        return { carousel: carouselEntity, products };
      });
  

       /**
     * VAQTINCHA O'CHIRILDI:
     * Cache sinovlari uchun isFavorite / isLiked tekshiruvlari vaqtincha o‘chirib turildi.
     * TODO: testlar tugagandan keyin bu logikani qayta yoqish kerak.
     */
    
      // Handle user-specific fields
      // if (userId && uniqueProductIds.length > 0) {
      //   const likedProducts = await Repository.UserLikedProducts().list(
      //     { page: 1, size: uniqueProductIds.length },
      //     { user: userId, isLiked: true, product: { $in: uniqueProductIds.map((id) => new Types.ObjectId(id)) } },
      //   );
  
      //   // const comparedProducts = await Repository.Compare().list(
      //   //   { page: 1, size: uniqueProductIds.length },
      //   //   { user: userId, product: { $in: uniqueProductIds.map((id) => new Types.ObjectId(id)) } },
      //   // );
  
      //   const likedProductMap = new Map<string, boolean>();
      //   for (const likedProduct of likedProducts) {
      //     const productId = (likedProduct.getProduct() as ProductEntity)?.getId()?.toString();
      //     if (productId) likedProductMap.set(productId, true);
      //   }
  
      //   // const comparedProductMap = new Map<string, boolean>();
      //   // for (const comparedProduct of comparedProducts) {
      //   //   const productId = (comparedProduct.getProduct() as ProductEntity)?.getId()?.toString();
      //   //   if (productId) comparedProductMap.set(productId, true);
      //   // }
  
      //   for (const item of response) {
      //     for (const product of item.products) {
      //       product.isFavorite = likedProductMap.get(product.id) ?? false;
      //       // product.addedCompare = comparedProductMap.get(product.id) ?? false;
      //     }
      //   }
      // }

      return { total: count, items: response };
    }
  }
  
  