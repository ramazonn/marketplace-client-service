import { Types } from 'mongoose';
import {
  BaseCaseInterface,
  BaseCaseParamsInterface,
  BaseError,
  CloudFlareService,
  DateTimeUtils,
  DeviceEntity,
  DeviceStatusEnum,
  GetMessageByNameCase,
  LanguageEnum,
  Log,
  MessageNameEnum,
  NewSessionMessageParams,
  NotFoundError,
  ProcessStepEnum,
  Repository,
  SmsService,
  Token,
  UserEntity,
} from '@ubaytools/core';
import * as moment from 'moment';
import { InvalidStepError } from '../../infrastructure/errors/InvalidSrep.error';
import { WelcomeBonusQueueService } from '../../services/queues/WelcomeBonusQueue.service';

export interface DeviceMetadataParams {
  ipAddress: string;
  osName: string;
  osVersion: string;
  osSdkVersion: string;
  model: string;
  userAgent: string;
  vendor: string;
  architecture: string;
  dpi: string;
}

export interface CreateSessionCaseParams {
  deviceUid: string;
  processId: string;
  trustedDevice: boolean;
  appVersion: string;
  metadata: DeviceMetadataParams;
  fcmToken?: string;
  language?: LanguageEnum;
}

export interface CreateSessionCaseResponse {
  finished: boolean;
  session: {
    id: string;
    token: string;
    expiresAt: string;
  };
  client: {
    id: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    avatar: string;
  };
}

class CreateSessionCase implements BaseCaseInterface<CreateSessionCaseParams, CreateSessionCaseResponse> {
  @Log()
  async execute(params: BaseCaseParamsInterface<CreateSessionCaseParams>): Promise<CreateSessionCaseResponse> {
    const language = params?.language;

    const currentProcess = await Repository.ProcessHistory().getById(new Types.ObjectId(params.processId));
    if (!currentProcess) throw new NotFoundError('Process');
    if (currentProcess.getStep() !== ProcessStepEnum.GET_SESSION) throw new InvalidStepError();
    const owner = currentProcess.getOwner() as Types.ObjectId;

    const jwtSecret = String(process.env.JWT_SECRET);
    const jwtExpiryMillis = Number(process.env.JWT_EXPIRY_MS);
    const accessTokenSlidingExpiryMillis = Number(process.env.JWT_EXPIRY_MS);
    const now = new Date();
    const accessTokenPermanentExpiryDate = moment(now).add(jwtExpiryMillis, 'milliseconds');
    const accessTokenSlidingExpiryDate = moment(now).add(accessTokenSlidingExpiryMillis, 'milliseconds');
    const payload = { clientId: owner.toString() };
    const accessToken = new Token(jwtSecret, jwtExpiryMillis, payload).sign();

    const device: DeviceEntity = await Repository.Device().getByDeviceUidAndByOwner(currentProcess.getDeviceUid(), owner);
    let isMain = false;
    if (!device?.getIsMain() && params?.trustedDevice) {
      const mainDevice = await Repository.Device().getMainByOwner(owner);
      if (!mainDevice) isMain = true;
    }

    let newDevice;
    if (!device) {
      newDevice = new DeviceEntity()
        .buildDeviceUid(currentProcess?.getDeviceUid())
        .buildOwner(currentProcess?.getOwner() as Types.ObjectId)
        .buildAccessToken(accessToken)
        .buildTrusted(params.trustedDevice)
        .buildAccessTokenPermanentExpiryDate(accessTokenPermanentExpiryDate.toDate())
        .buildAccessTokenSlidingExpiryDate(accessTokenSlidingExpiryDate.toDate())
        .buildLastLoginDate(now)
        .buildLastActivityDate(now)
        .buildAppVersion(params.appVersion)
        .buildFcmToken(params.fcmToken)
        .buildMetadata(params.metadata)
        .buildIsMain(isMain);
      await Repository.Device().create(newDevice);
    } else {
      device
        .buildTrusted(params.trustedDevice)
        .buildAccessToken(accessToken)
        .buildAccessTokenPermanentExpiryDate(accessTokenPermanentExpiryDate.toDate())
        .buildAccessTokenSlidingExpiryDate(accessTokenSlidingExpiryDate.toDate())
        .buildLastLoginDate(now)
        .buildLastActivityDate(now)
        .buildAppVersion(params.appVersion)
        .buildFcmToken(params.fcmToken)
        .buildMetadata(params.metadata)
        .buildStatus(DeviceStatusEnum.ACTIVE)
        .buildIsMain(isMain);
      await Repository.Device().update(device);
    }

    currentProcess.buildToken(null).buildFinished(true);
    await Repository.ProcessHistory().update(currentProcess);

    const user = await Repository.Users().getById(currentProcess?.getOwner() as Types.ObjectId);
    if (!user) throw new NotFoundError('User');
    const response = {
      finished: true,
      session: {
        id: currentProcess.getId().toHexString(),
        token: accessToken,
        expiresAt: accessTokenSlidingExpiryDate.toISOString(),
      },
      client: {
        middleName: user.getUserInfo()?.getMiddlename() ?? null,
        birthDate: user.getUserInfo()?.getBirthdate() ? moment(user.getUserInfo()?.getBirthdate()).format('DD/MM/YYYY') : null,
        avatar: user.getUserInfo()?.getAvatar() ? CloudFlareService.getImageUrlByFileID(user.getUserInfo().getAvatar()) : null,
        gender: user.getUserInfo()?.getGender() ?? null,
        phoneNumber: user.getPhoneNumber() ?? null,
        email: user.getUserInfo()?.getEmail() ?? null,
        enableNotification: user.getUserInfo()?.getEnableNotification() ?? null,
        id: user.getId().toHexString(),
        firstName: user?.getUserInfo()?.getFirstname() ?? null,
        lastName: user?.getUserInfo()?.getLastname() ?? null,
      },
    };

    if (language) user.buildLanguage(language);
    await Repository.Users().update(user);
    const welcomeBonusQueue = WelcomeBonusQueueService.getInstance();
    await welcomeBonusQueue.publishToQueue(user.getId().toString());
    return response;
  }
}

export const createSessionCase: BaseCaseInterface<CreateSessionCaseParams, CreateSessionCaseResponse> = new CreateSessionCase();
