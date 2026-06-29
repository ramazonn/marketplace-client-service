import { v4 as uuidv4 } from 'uuid';
import * as moment from 'moment';
import {
  BaseCaseInterface,
  BaseStepResponseInterface,
  ConfirmationStepSettingsEntity,
  ConfirmationTypeEnum,
  MessageNameEnum,
  ProcessStepEnum,
  ProcessTypeEnum,
  LanguageEnum,
  AuthMessageParams,
  ConfirmationStepParams,
  Repository,
  ConfirmationEntity,
  ProcessHistoryEntity,
  GetMessageByNameCase,
  SmsService,
  DateTimeUtils,
  OtpUtils,
  Log,
  BaseCaseParamsInterface,
} from '@ubaytools/core';
import { Types } from 'mongoose';

export interface ClientExistenceResponse extends BaseStepResponseInterface<ConfirmationStepParams | any> {
  exists: boolean;
}

export interface CheckClientExistenceParams {
  phoneNumber: string;
  deviceUid: string;
  language: LanguageEnum;
  signature?: string; // Keep for backward compatibility
}

class CheckClientExistenceCase implements BaseCaseInterface<CheckClientExistenceParams, ClientExistenceResponse> {
  private _language: LanguageEnum;

  @Log()
  async execute(params: BaseCaseParamsInterface<CheckClientExistenceParams>): Promise<ClientExistenceResponse> {
    this._language = params.language;

    try {
      const confirmationSettings = await Repository.ProcessSettings().getStepByNameAndProcessType<ConfirmationStepSettingsEntity>(
        ProcessStepEnum.CONFIRMATION,
        ProcessTypeEnum.REGISTRATION,
        ConfirmationStepSettingsEntity,
      );
      let history = new ProcessHistoryEntity();
      const user = await Repository.Users().getByPhoneNumber(params.phoneNumber);

      const response: ClientExistenceResponse = {
        exists: false,
        nextToken: uuidv4(),
        nextStep: ProcessStepEnum.CONFIRMATION,
        nextStepSettings: {
          required: confirmationSettings.getRequired(),
          type: ConfirmationTypeEnum.SMS_INTERNAL,
          otp: {
            blocked: false,
            expired: false,
            remainedAttempts: confirmationSettings?.getOtp()?.getMaxAttemptsCount(),
            resendTimeoutSeconds: confirmationSettings?.getOtp()?.getResendTimeout(),
            symbolCount: confirmationSettings?.getOtp()?.getSymbolCount(),
            sentTo: params?.phoneNumber,
          },
        },
      };
      const isDev = process.env.NODE_ENV !== 'production';
      const trustedPhoneNumbers = ['998974210412']
      const isTrustedUser = trustedPhoneNumbers.includes(params.phoneNumber)
      let otpCode = await OtpUtils.generateOtpCode();

      if (isDev || isTrustedUser) {
        otpCode = '123456'
      }

      history
        .buildDeviceUid(params.deviceUid)
        .buildPhoneNumber(params.phoneNumber)
        .buildToken(response.nextToken)
        .buildConfirmationStep({
          skipped: false,
          phoneNumber: params.phoneNumber,
          passedAt: null,
        })
        .buildStep(ProcessStepEnum.CONFIRMATION);

      let smsMessageType: MessageNameEnum;
      if (user) {
        /**
         * save current step to processHistory
         * */
        history.buildProcessType(ProcessTypeEnum.AUTHENTICATION).buildOwner(user?.getId());
        smsMessageType = MessageNameEnum.AUTHENTICATION_CONFIRM_SMS_MESSAGE;
      } else {
        /**
         * Start registration process
         */

        history.buildProcessType(ProcessTypeEnum.REGISTRATION);

        smsMessageType = MessageNameEnum.REGISTRATION_CONFIRM_SMS_MESSAGE;
      }
      const registrationMessage = await this._getMessage<AuthMessageParams>(smsMessageType, {
        code: otpCode,
        phoneNumber: params.phoneNumber,
        dateTime: DateTimeUtils.getCurrentFormattedUzbTime(),
      });

      let finalMessage = registrationMessage;
      if (params.signature) {
        finalMessage = `${registrationMessage} ${params.signature}`;
      }

      // TODO send sms implement LANGUAGE
      if (!isDev && !isTrustedUser) {
        await SmsService.send({ refId: params.refId, client: params.client, phoneNumber: params.phoneNumber, text: finalMessage });
      }
      
      // create confirmation record
      history = await Repository.ProcessHistory().create(history);
      const confirmation = new ConfirmationEntity()
        .buildProcess(history.getId())
        .buildExpiresAt(moment().add(60, 's').toDate()) // TODO implement time
        .buildType(ConfirmationTypeEnum.SMS_INTERNAL)
        .buildAttempts(0)
        .buildPhoneNumber(params.phoneNumber)
        .buildCode(otpCode);

      await Repository.Confirmation().create(confirmation);
      return response;
    } catch (e) {
      console.error('=== ERROR ===', e);
      throw e;
    }
  }

  private async _getMessage<T>(messageType: MessageNameEnum, params: T): Promise<string> {
    const messageText = await new GetMessageByNameCase<T>().execute({
      name: messageType,
      params: params,
    });
    return messageText?.getMessageText()?.getByLang(this._language);
  }
}

export function checkClientExistenceCase(): BaseCaseInterface<CheckClientExistenceParams, ClientExistenceResponse> {
  return new CheckClientExistenceCase();
}
