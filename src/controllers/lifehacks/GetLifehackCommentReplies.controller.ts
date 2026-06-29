import { prefix, request, security, summary, tags, path, query } from 'koa-swagger-decorator';
import { Context } from 'koa';
import { Types } from 'mongoose';
import {
    LifehackCommentTypeEnum,
    NotFoundError,
    Repository,
} from '@ubaytools/core';
import { IdParams, ListParams } from '../../infrastructure';

class LifehackCommentReplyListItemResponse {
    id: string;
    text: string;
    createdAt: Date;
    updatedAt: Date;
    admin: {
        id: string;
        firstName?: string;
        lastName?: string;
    } | null;

    constructor(reply: any) {
        this.id = reply.getId()?.toString();
        this.text = reply.getText();
        this.createdAt = reply.getCreatedAt();
        this.updatedAt = reply.getUpdatedAt();

        const admin = reply.getAdmin();

        if (
            admin &&
            typeof admin === 'object' &&
            !(admin instanceof Types.ObjectId)
        ) {
            this.admin = {
                id: admin.getId()?.toString?.() || '',
                firstName: admin.getFirstName?.() || '',
                lastName: admin.getLastName?.() || '',
            };
        } else {
            this.admin = null;
        }
    }
}

@prefix('/lifehacks')
export default class GetLifehackCommentRepliesController {
    @request('get', '/comment-replies-list/{commentId}')
    @summary('Lifehack comment replies list')
    @security([])
    @tags(['Lifehacks'])
    @path({ commentId: { type: 'string', required: true } })
    @query((ListParams as any).swaggerDocument)
    static async controller(context: Context): Promise<void> {
        let idParams: IdParams;
        let listParams: ListParams;

        try {
            idParams = await new IdParams({
                id: context.params.commentId,
            }).validate();

            listParams = await new ListParams(context.query).validate();
        } catch (error) {
            const joiError = await context.joi.handle(error);
            return context.send.error(joiError);
        }

        try {
            const commentId = new Types.ObjectId(idParams.id);
            const foundComment = await Repository.LifehackComments().getById(commentId);
            if (!foundComment) {
                throw new NotFoundError('Comment');
            }
            const replies = await Repository.LifehackComments().list(
                {
                    page: listParams.page,
                    size: listParams.size,
                },
                {
                    parentComment: commentId,
                    type: LifehackCommentTypeEnum.REPLY,
                },
                { createdAt: 1 },
            );
            const repliesCount =
                await Repository.LifehackComments().countDocumentsByFilter({
                    parentComment: commentId,
                    type: LifehackCommentTypeEnum.REPLY,
                });
            return context.send.data({
                replies: replies.map(
                    (reply) => new LifehackCommentReplyListItemResponse(reply),
                ),
                repliesCount,
            });
        } catch (error) {
            return context.send.error(error);
        }
    }
}