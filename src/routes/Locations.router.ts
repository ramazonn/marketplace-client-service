import * as KoaRouter from '@koa/router';
import { AddressControllers } from '../controllers';

export const LocationRouter = new KoaRouter();

LocationRouter.get('/ubay-point/list', AddressControllers.UbayPointController);
LocationRouter.get('/uzb-locations/list', AddressControllers.UzbLocationsController);
LocationRouter.get('/delivery-point/list', AddressControllers.DeliveryPointController);
LocationRouter.get('/emu/delivery-point/list', AddressControllers.EmuDeliveryPointController);
LocationRouter.get('/uzpost/delivery-point/list', AddressControllers.UzpostDeliveryPointController);
