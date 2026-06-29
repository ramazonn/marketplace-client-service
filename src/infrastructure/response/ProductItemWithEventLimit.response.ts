import { CloudFlareService, LanguageEnum } from '@ubaytools/core';

export class SpecialEventProductItemResponse {
  id: string;
  name: string;
  description: string;
  oldPrice: number;
  currentPrice: number;
  discount_percent: number;
  discount_price: number;
  flags: Array<{ key: string; color: string }>;
  images: Array<string>;
  videos: Array<string>;
  isFavorite: boolean;
  avgStars: number;
  countOfReview: number;
  characteristics: Array<{ key: string; value: string }>;
  store: any;
  brand: { id: string; name: string };
  model: { id: string; name: string };
  guaranty: string;
  count: number;
  categoryId: string;
  categoryName: string;
  soldCount: number;
  short_description: string;
  advantages: string;
  eventProductLimit: number;

  constructor(product: any, characteristics: any, lang: LanguageEnum, eventProductLimit: number, discountPercent: number, discountPrice: number, ) {
    const baseLang = this.getBaseLanguage(lang);

    this.id = product._id.toString();
    this.name = product.name?.[baseLang] ?? null;
    this.description = product.infos?.description?.[baseLang] ?? null;
    this.short_description = product.infos?.short_description?.[baseLang] ?? null;
    this.advantages = product.infos?.advantages?.[baseLang] ?? null;
    this.oldPrice = product.infos?.old_price ?? null;
    this.currentPrice = product.infos?.current_price ?? null;
    this.discount_percent =discountPercent;
    this.discount_price = discountPrice;
    this.guaranty = product.infos?.guaranty ?? null;
    this.flags = this.processFlags(product.flagsInfo, baseLang);
    this.images = product.attachments?.length > 0 ? product.attachments.map((item) => CloudFlareService.getImageUrlByFileID(item)) : null;
    this.videos = product.videos ?? null;
    // VAQTINCHA O'CHIRILDI:
    // Cache sinovlari uchun isFavorite / isLiked tekshiruvlari vaqtincha o‘chirib turildi.
    this.isFavorite = product.isFavorite ?? false;
    this.avgStars = product?.avgStars ? +product?.avgStars.toFixed(1) : null;
    this.countOfReview = product?.countOfReview ?? null;
    this.characteristics = characteristics ?? null;
    this.brand = product.brand ? { id: product.brand._id.toString(), name: product.brand.title[baseLang] } : null;
    this.model = product.model ? { id: product.model._id.toString(), name: product.model.title[baseLang] } : null;
    this.store = product.store
      ? {
          id: product.store._id.toString(),
          name: product.store.name,
          sku: product.store.shortname,
          description: product.store.description?.[baseLang] ?? null,
          avatar: product.store.avatar ? CloudFlareService.getImageUrlByFileID(product.store.avatar) : null,
          avgStars: product.storeAvgStars ? Math.floor(product.storeAvgStars*10)/10 : null,
          productCount: product.storeProductCount,
          createdAt: product.createdAt,
          cover_banner: product.store?.cover_banner ? CloudFlareService.getImageUrlByFileID(product.store?.cover_banner) : null,
          social_links: product.store?.social_links ?? [],
        }
      : null;
    this.count = product.count || 0;
    this.categoryId = product.category?._id?.toString() ?? null;
    this.categoryName = product.category?.name?.[baseLang] ?? null;
    this.soldCount = product.stats?.sold;
    this.eventProductLimit = eventProductLimit;
  }
  private getBaseLanguage(lang: string): string {
    // Extract the base language code (e.g., 'en' from 'en-US')
    const baseLang = lang.split('-')[0].toLowerCase();

    // Map the base language to the supported languages in your system
    const supportedLanguages = ['en', 'ru', 'uz'];
    return supportedLanguages.includes(baseLang) ? baseLang : 'en'; // Default to 'en' if not supported
  }

  private processFlags(flags: any[], lang: string): Array<{ key: string; color: string }> {
    if (!Array.isArray(flags)) return [];

    return flags.map((flag) => ({
      key: flag.name?.[lang] || flag.name?.['en'] || '',
      color: flag.color || '#000000', // Default to black if no color is specified
    }));
  }
}
