import { CloudFlareService, LanguageEnum, MessageTypeEnum, SenderTypeEnum } from '@ubaytools/core';
import { ChatMessagesEntity, ProductEntity } from '@ubaytools/core';

export class ChatMessageItemResponse {
  id: string;
  chatId: any;
  message: string;
  messageType: MessageTypeEnum;
  senderType: SenderTypeEnum;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string,
    name: string,
    attachments: string[], 
    currentPrice: number, 
    discountPrice: number
  }

  constructor(message: ChatMessagesEntity, lang: LanguageEnum) {

    this.id = message.getId()?.toString() ?? null;
    this.chatId = message.getChatId().toString() ?? null
    this.message = message.getMessage() ?? null;
    this.messageType = message.getMessageType() as MessageTypeEnum;
    this.senderType = message.getSenderType() as SenderTypeEnum;
    this.isRead = message.getIsRead() ?? false;
    this.createdAt = message.getCreatedAt() ?? null;
    this.updatedAt = message.getUpdatedAt() ?? null;

    this.product = message.getProduct()
      ? {
        id: (message.getProduct() as ProductEntity).getId()?.toString(),
        name: (message.getProduct() as ProductEntity).getName()?.getByLang(lang),
        attachments: ((message.getProduct() as ProductEntity).getAttachments() ?? []).map(
          (id: string) => CloudFlareService.getImageUrlByFileID(id),
        ),
        currentPrice: (message.getProduct() as ProductEntity)
          .getProductInfo()
          ?.getCurrentPrice?.(),
        discountPrice: (message.getProduct() as ProductEntity)
          .getProductInfo()
          ?.getDiscountPrice?.(),
      }
      : null;
  }
}