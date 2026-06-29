import { CloudFlareService, LanguageEnum, PreOrderShippingInfoSchema } from '@ubaytools/core';

export class ProductItemResponse {
  id: string;
  name: string;
  description: string;
  // oldPrice: number;
  currentPrice: number;
  discount_percent: number;
  discount_price: number;
  flags: Array<{ key: string; color: string }>;
  images: Array<string>;
  videos: Array<string>;
  isFavorite: boolean;
  addedCompare: boolean;
  avgStars: number;
  countOfReview: number;
  countOfViews: number;
  characteristics: Array<{ key: string; value: string }>;
  store: any;
  brand: { id: string; name: string };
  // model: { id: string; name: string };
  guaranty: string;
  count: number;
  categoryId: string;
  categoryName: string;
  soldCount: number;
  short_description: string;
  advantages: string;
  specialEvent: { id: string; name: string; eventLimit: number; eventProductLimit: number, isActive: boolean };
  cashbackPercent: number;
  isPreOrder: boolean;
  preOrderShippingInfo: PreOrderShippingInfoSchema;
  installments: Object

  constructor(product: any, characteristics: any, instalmans: Object, lang: LanguageEnum) {
    const baseLang = this.getBaseLanguage(lang);

    this.id = product._id.toString();
    this.name = product.name?.[baseLang] ?? null;
    this.description = product.infos?.description?.[baseLang] ?? null;
    this.short_description = product.infos?.short_description?.[baseLang] ?? null;
    this.advantages = product.infos?.advantages?.[baseLang] ?? null;
    // this.oldPrice = product.infos?.old_price ?? null;
    this.currentPrice = product.infos?.current_price ?? null;
    this.discount_percent = product.specialEvent && product.specialEvent.isActive ? product.specialEvent.discountPercent : product.infos?.discount_percent ?? 0;
    this.discount_price = product.specialEvent && product.specialEvent.isActive ? product.specialEvent.discountPrice : product.infos?.discount_price ?? 0;
    this.guaranty = product.infos?.guaranty ?? null;
    this.flags = this.processFlags(product.flagsInfo, baseLang);
    this.images = product.attachments?.length > 0 ? product.attachments.map((item) => CloudFlareService.getImageUrlByFileID(item)) : null;
    this.videos = product.videos ?? [];
    // VAQTINCHA O'CHIRILDI:
    // Cache sinovlari uchun isFavorite / isLiked tekshiruvlari vaqtincha o‘chirib turildi.
    this.isFavorite = product.isFavorite ?? false;
    this.addedCompare = product.addedCompare ?? false;
    this.avgStars = product?.stats?.avgStars ?? 0;
    this.countOfReview = product?.stats?.countOfReviews ?? 0;
    this.countOfViews = product?.stats?.countOfViews ?? 0;
    this.characteristics = characteristics ?? null;
    this.brand = product.brand ? { id: product.brand._id.toString(), name: product.brand.title[baseLang] } : null;
    // this.model = { id: "id", name: "name" }//product.model ? { id: product.model._id.toString(), name: product.model.title[baseLang] } : null;
    this.store = product.store
      ? {
        id: product.store._id.toString(),
        name: product.store.name,
        avatar: product.store.avatar ? CloudFlareService.getImageUrlByFileID(product.store.avatar) : null,
        avgStars: 4.8, // TODO: avgStars va product countni har safar lookupda olmasdan storeni o'zida saqlab ketib shundan olish
        productCount: 500,
        stats: {
        avgStars: product.store?.storeStats?.avgStars ?? 0,
        countOfProducts: product.store?.storeStats?.countOfProducts ?? 0,
        countOfReviews: product.store?.storeStats?.countOfReviews ?? 0,
        countOfOrders: product.store?.storeStats?.countOfOrders ?? 0,
      },

      }
      : null;
    this.count = product.count || 0;
    this.categoryId = product.category?._id?.toString() ?? null;
    this.categoryName = product.category?.name?.[baseLang] ?? null;
    this.soldCount = product.stats?.sold;
    this.specialEvent = product.specialEvent ? {
      id: product.specialEvent._id.toString(),
      name: product.specialEvent.name?.[baseLang] ?? null,
      eventLimit: product.specialEvent.eventLimit,
      eventProductLimit: product.specialEvent.eventProductLimit,
      isActive: product.specialEvent.isActive
    } : null;
    this.cashbackPercent = product?.cashbackPercent ?? null;
    this.isPreOrder = product?.isPreOrder ?? false;
    this.preOrderShippingInfo = product.preOrderShippingInfo ?? {};
    this.installments = instalmans
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
