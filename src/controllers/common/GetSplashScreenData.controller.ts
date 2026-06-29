import { prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { LanguageEnum, NotFoundError, Repository, SplashScreenEntity } from '@ubaytools/core';

export class SplashScreenDataItemResponse {
  title: string;
  description: string;
  imageUrl: string;
  order: number;
  constructor(splashScreen: SplashScreenEntity, lang: LanguageEnum) {
    this.title = splashScreen.getTitle().getByLang(lang);
    this.description = splashScreen.getDescription().getByLang(lang);
    this.imageUrl = splashScreen.getImageUrl();
    this.order = splashScreen.getOrder();
  }
}

@prefix('/common/splash')
export default class GetSplashScreenDataController {
  @request('get', '/list')
  @summary('Splash Screen list')
  @security([])
  @tags(['Common'])
  static async controller(context: Context): Promise<void> {
    try {
      const settings = await Repository.Settings().getSettings();
      if (!settings) {
        throw new NotFoundError('Settings');
      }
      const splashes = settings.getSplashScreens();
      const response = splashes.map((item) => new SplashScreenDataItemResponse(item, context.lang));
      return context.send.data({ total: response.length, items: response });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
