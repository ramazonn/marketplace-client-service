import { formData, prefix, request, security, summary, tags } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { CloudFlareService } from '@ubaytools/core';

@prefix('/common')
export default class UploadImageController {
  @request('post', '/upload-image')
  @summary('Upload image')
  @security([])
  @tags(['Common'])
  @formData({ file: { type: 'file', required: true, description: 'file content' } })
  static async controller(context: Context): Promise<void> {
    try {
      const cloudFlareService = new CloudFlareService();
      const result = await cloudFlareService.uploadImage(context.file);
      return context.send.data({ fileId: result.id });
    } catch (error) {
      return context.send.error(error);
    }
  }
}
