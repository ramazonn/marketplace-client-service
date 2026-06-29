import * as Joi from 'joi';
import { swaggerClass, swaggerProperty } from 'koa-swagger-decorator';

@swaggerClass()
export class SearchByImageParams {
    @swaggerProperty({ type: 'string', required: false }) session: string;

    constructor(params: any) {
        if (params) {
            this.session = params?.session;
        }
    }

    async validate() {
        return await SearchByImageParamsSchema.validateAsync(this);
    }
}

export const SearchByImageParamsSchema = Joi.object<SearchByImageParams>({
    session: Joi.string().optional()
});
