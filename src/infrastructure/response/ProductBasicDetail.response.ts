import { CloudFlareService, LanguageEnum, PreOrderShippingInfoSchema } from '@ubaytools/core';

export class ProductBasicDetailResponse {
  id: string;
  name: string;
  currentPrice: number;
  discount_percent: number;
  discount_price: number;
  flags: Array<{ key: string; color: string }>;
  images: Array<string>;
  isFavorite: boolean;
  avgStars: number;
  countOfReview: number;
  count: number;
  categoryId: string;
  categoryName: string;
  soldCount: number;
  specialEvent: { id: string; name: string; eventLimit: number; eventProductLimit: number, isActive: boolean };
  isPreOrder: boolean;
  preOrderShippingInfo: PreOrderShippingInfoSchema;

  constructor(product: any, lang: LanguageEnum) {
    const baseLang = this.getBaseLanguage(lang);

    this.id = product._id.toString();
    this.name = product.name?.[baseLang] ?? null;
    this.currentPrice = product.infos?.current_price ?? null;
    this.discount_percent = product.specialEvent && product.specialEvent.isActive ? product.specialEvent.discountPercent : product.infos?.discount_percent ?? 0;
    this.discount_price = product.specialEvent && product.specialEvent.isActive ? product.specialEvent.discountPrice : product.infos?.discount_price ?? 0;
    this.flags = this.processFlags(product.flagsInfo, baseLang);
    this.images = product.attachments?.length > 0 ? product.attachments.map((item) => CloudFlareService.getImageUrlByFileID(item)) : null;
    this.isFavorite = false;
    this.avgStars = product?.stats?.avgStars ? +product?.stats?.avgStars.toFixed(1) : 0;
    this.countOfReview = product?.stats?.countOfReviews ? +product?.stats?.countOfReviews.toFixed(1) : 0;
    this.count = product.count || 0;
    this.categoryId = product.category?.toString() || null;
    this.isPreOrder = product?.isPreOrder ?? false;
    this.preOrderShippingInfo = product.preOrderShippingInfo ?? {};
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
