import { Types } from 'mongoose';
import { CarouselProductEntity, LanguageEnum, ProductEntity, Redis, Repository } from '@ubaytools/core';
import { GetProductDetailUseCase } from '../product/GetProductDetail.usecase';
import { ProductBasicDetailResponse } from '../../infrastructure';

export class GetSingleCarouselUseCase {
  static async execute(carouselId: string, lang: LanguageEnum, userId?: string) {
    const redisClient = await Redis.getInstance();

    // Get carousel from DB (always fetch real entity)
    const carousel = await Repository.Carousels().getById(new Types.ObjectId(carouselId));

    // Get productIds from cache or extract from carousel
    const carouselCacheKey = `${process.env.NODE_ENV}:carousel:${carouselId}:${lang}`;
    let cachedCarousel: any = await redisClient.get(carouselCacheKey);
    let productIds: string[] = [];

    if (cachedCarousel) {
      try {
        const carouselData = JSON.parse(cachedCarousel);
        productIds = carouselData.productIds || [];
      } catch (error) {
        // Parse error, extract from carousel
        productIds = carousel.getProducts().map((cp: CarouselProductEntity) => cp.getProduct().toString());
      }
    } else {
      // Not cached, extract from carousel and cache
      productIds = carousel.getProducts().map((cp: CarouselProductEntity) => cp.getProduct().toString());
      
      const carouselData = {
        id: carousel.getId().toString(),
        title: carousel.getTitle()?.getByLang(lang) ?? null,
        status: carousel.getStatus(),
        productIds: productIds,
        productCount: productIds.length,
      };
      await redisClient.set(carouselCacheKey, JSON.stringify(carouselData), 24 * 60 * 60);
    }

    if (!productIds || productIds.length === 0) {
      return { carousel, products: [] };
    }

    // Batch get all product caches at once (single Redis call)
    const productCacheKeys = productIds.map((productId) => `${process.env.NODE_ENV}:product:basic:${productId}:${lang}`);
    const cachedProductsData = await redisClient.mget(productCacheKeys);

    // Process cached products
    const productMap = new Map<string, ProductBasicDetailResponse>();
    let missingProductIds: Types.ObjectId[] = [];

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const cachedData = cachedProductsData[i];

      if (cachedData) {
        try {
          const productData = JSON.parse(cachedData);
          const product = new ProductBasicDetailResponse(productData, lang);
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

    // Build products array in order
    const products = productIds
      .map((productId) => productMap.get(productId))
      .filter((product): product is ProductBasicDetailResponse => product !== undefined);

    /**
    * VAQTINCHA O‘CHIRILDI:
    * Cache ishlashini sinash uchun isFavorite / isLiked tekshiruvlari o‘chirildi.
    * TODO: test tugagandan keyin qayta yoqish kerak.
    */


    // Handle user-specific fields
    // if (userId && productIds.length > 0) {
    //   const objectIds = productIds.map((id) => new Types.ObjectId(id));

    //   const likedProducts = await Repository.UserLikedProducts().list(
    //     { page: 1, size: productIds.length },
    //     { user: userId, isLiked: true, product: { $in: objectIds } },
    //   );

    //   const likedProductMap = new Map<string, boolean>();
    //   for (const likedProduct of likedProducts) {
    //     const pid = (likedProduct.getProduct() as ProductEntity)?.getId()?.toString();
    //     if (pid) likedProductMap.set(pid, true);
    //   }

    //   for (const product of products) {
    //     product.isFavorite = likedProductMap.get(product.id) ?? false;
    //   }
    // }

    return { carousel, products };
  }
}

