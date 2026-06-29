import { path, prefix, query, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { IdParams, ListParams } from '../../infrastructure';
import { BrandsEntity, CloudFlareService, LanguageEnum, VideoContentsEntity, NotFoundError, Repository } from '@ubaytools/core';
import { Types } from 'mongoose';

class VideoContentDetailResponse {
  id: string;
  videoLink: string;
  title: string;
  description: string;
  constructor(videoContent: VideoContentsEntity, lang:LanguageEnum) {
    this.id = videoContent.getId().toString();
    this.videoLink = videoContent.getVideoLink()
    this.title = videoContent.getTitle().getByLang(lang)
    this.description = videoContent.getDescription()?.getByLang(lang)
  }
}

@prefix('/video-contents')
export default class GetVideoContentDetailByIdController {
  @request('get', '/detail/{videoContentId}')
  @summary('Video Content detail')
  @security([])
  @tags(['Video Contents'])
  @path({ videoContentId: { type: 'string', required: true } })
  static async controller(context: Context): Promise<void> {
    let params: IdParams;
    try {
      params = await new IdParams({ id: context.params.videoContentId }).validate();
    } catch (error) {
      const joiError = await context.joi.handle(error);
      return context.send.error(joiError);
    }
    try {
      const foundVideoContent = await Repository.VideoContents().getById(new Types.ObjectId(params.id));
      if (!foundVideoContent) {
        throw new NotFoundError('VideoContent');
      }
      const response = new VideoContentDetailResponse(foundVideoContent,context.lang);
      return context.send.data(response);
    } catch (error) {
      return context.send.error(error);
    }
  }
}
