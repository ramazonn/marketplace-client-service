import { Context } from 'koa';
import {
  ApplicationLogTemplateInterface,
  clearProcessBlockingCase,
  ErrorCodeEnum,
  LanguageEnum,
  LogService,
  LogTypeEnum,
  SystemError,
} from '@ubaytools/core';

interface ErrorResponse {
  message: string;
  code: ErrorCodeEnum;
  clientMessage: string;
}

export class ResponseService {
  protected _context: Context;

  constructor(context: Context) {
    this._context = context;
  }

  async data(json: JSON, status = 200) {
    this._context.body = {
      error: null,
      data: json,
    };
    this._context.status = status;
    await clearProcessBlockingCase.execute({ processId: this._context?.process?.getId() });
    const log: LogService = LogService.getInstance();
    const currentTime = new Date();
    const requestTime = new Date(this._context.reqTime);
    const logData: ApplicationLogTemplateInterface = {
      path: this._context.path,
      method: this._context.method,
      refId: this._context?.refId,
      user: this._context?.client?.getId(),
      source: 'UbaytoolsClientApi.ResponseService',
      // request: this._context.request.body,
      request: this._sanitizeLogPayload(this._context.request.body),
      // response: this._context.body,
      response: this._sanitizeLogPayload(this._context.body),
      requestTime: requestTime,
      responseTime: currentTime,
      duration: currentTime.getTime() - requestTime.getTime(),
      appLevel: process.env.SERVICE_NAME,
      logType: LogTypeEnum.APP_LOG,
      statusCode: status,
    };
    log.info(LogTypeEnum.APP_LOG, logData);
  }

  async error(error: any) {
    console.error({
      message: error?.message,
      stack: error?.stack,
    });
    this._context.body = {
      error: this._createErrorResponse(error),
      data: error?.details,
    };
    const log: LogService = LogService.getInstance();
    const currentTime = new Date();
    const requestTime = new Date(this._context.reqTime);
    const logData: ApplicationLogTemplateInterface = {
      path: this._context.path,
      method: this._context.method,
      refId: this._context?.refId,
      user: this._context?.client?.getId(),
      source: 'UbaytoolsClientApi.ResponseService',
      // request: this._context.request.body,
      request: this._sanitizeLogPayload(this._context.request.body),
      // response: this._context.body,
      response: {
        error: {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
        },
      },
      requestTime: requestTime,
      responseTime: currentTime,
      duration: currentTime.getTime() - requestTime.getTime(),
      appLevel: process.env.SERVICE_NAME,
      logType: LogTypeEnum.APP_LOG,
      statusCode: this._context.status,
    };
    log.error(LogTypeEnum.APP_LOG, logData);
  }

  async pure(data: any) {
    this._context.body = data;
  }

  private _createErrorResponse(error: any): ErrorResponse {
    let httpStatusCode: number;
    let clientMessage = this._createClientMessage(error);

    switch (error?.code) {
      case ErrorCodeEnum.CONFIRMATION_RESEND_TIMEOUT:
      case ErrorCodeEnum.CONFIRMATION_CODE_INVALID:
        httpStatusCode = 412;
        break;

      case ErrorCodeEnum.CONFIRMATION_CODE_EXPIRED:
      case ErrorCodeEnum.AUTH_BLOCK_LIST_ERROR:
      case ErrorCodeEnum.CONFIRMATION_VALIDATE_ATTEMPT_EXCEEDED:
        httpStatusCode = 403;
        break;

      case ErrorCodeEnum.AUTHORIZATION_ERROR:
      case ErrorCodeEnum.CDN_SERVICE_AUTHORIZATION_ERROR:
      case ErrorCodeEnum.DEVICE_NOT_FOUND:
        httpStatusCode = 401;
        break;

      case ErrorCodeEnum.REQUIREMENT_ERROR:
      case ErrorCodeEnum.VALIDATION_FAIL_TO_MATCH_ERROR:
      case ErrorCodeEnum.VALIDATION_MATCH_EMPTY_ERROR:
      case ErrorCodeEnum.INCORRECT_PASSWORD_ERROR:
      case ErrorCodeEnum.NOT_IMPLEMENTED:
      case ErrorCodeEnum.CDN_SERVICE_GET_FILE_ERROR:
      case ErrorCodeEnum.CDN_SERVICE_WRONG_FILE_EXTENSION_ERROR:
      case ErrorCodeEnum.CDN_SERVICE_INVALID_REQUEST_ERROR:
      case ErrorCodeEnum.CDN_SERVICE_TIMEOUT_ERROR:
      case ErrorCodeEnum.BAD_REQUEST:
        httpStatusCode = 400;
        break;

      case ErrorCodeEnum.WRONG_FILE_EXTENSION_ERROR:
      case ErrorCodeEnum.UNPROCESSABLE_ENTITY:
        httpStatusCode = 422;
        break;

      case ErrorCodeEnum.CDN_SERVICE_UNAVAILABLE_ERROR:
        httpStatusCode = 500;
        break;

      case ErrorCodeEnum.NOT_FOUND:
        httpStatusCode = 404;
        break;

      default:
        httpStatusCode = 500;
        clientMessage = this._createClientMessage(new SystemError());
    }

    this._context.status = httpStatusCode;
    return {
      message: error?.message,
      code: error?.code,
      clientMessage,
    };
  }

  private _createClientMessage(error: any): string {
    const language = this._context.header['content-language'] ?? LanguageEnum.UZ;
    if (!error?.translates) return null;
    return error?.translates[language];
  }

  private _sanitizeLogPayload(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'cookie'];

    if (Buffer.isBuffer(data)) {
      return `[Buffer size=${data.length}]`;
    }

    if (typeof data === 'string') {
      return data.length > 200 ? `[String length=${data.length}]` : data;
    }

    if (Array.isArray(data)) {
      return `[Array(${data.length})]`;
    }

    if (typeof data === 'object') {
      const result = {};

      for (const [key, value] of Object.entries(data)) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
          result[key] = '***REDACTED***';
          continue;
        }

        result[key] = this._sanitizeLogPayload(value);
      }

      return result;
    }

    return data;
  }
}
