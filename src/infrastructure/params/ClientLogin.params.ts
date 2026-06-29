import {LanguageEnum} from "@ubaytools/core";

export class ClientLoginParams {
  phoneNumber: string;
  passwordHash: string;
  deviceUid:string;
  language: LanguageEnum;
}
