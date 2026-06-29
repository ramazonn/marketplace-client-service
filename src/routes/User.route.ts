import * as KoaRouter from '@koa/router';
import { UserControllers } from '../controllers';
import { CheckClientSessionMiddleware } from '../middlewares';

export const UserRouter = new KoaRouter().prefix('/user');

UserRouter.get('/favorite/list', CheckClientSessionMiddleware(), UserControllers.GetMyFavoriteProductsController);
UserRouter.put('/favorite/remove-like', CheckClientSessionMiddleware(), UserControllers.RemoveLikeFromProductController);
UserRouter.put('/favorite/set-like', CheckClientSessionMiddleware(), UserControllers.SetLikeToProductController);

UserRouter.get('/basket/list', CheckClientSessionMiddleware(), UserControllers.GetUserBasketController);
UserRouter.put('/basket/add-product', CheckClientSessionMiddleware(), UserControllers.PutProductToBasketController);
UserRouter.put('/basket/remove-product', CheckClientSessionMiddleware(), UserControllers.RemoveProductFromBasketController);
UserRouter.put('/basket/count/:baskedProductId', CheckClientSessionMiddleware(), UserControllers.UpdateProductCountInBasketController);

UserRouter.post('/address/add', CheckClientSessionMiddleware(), UserControllers.AddUserAddressController);
UserRouter.put('/address/:addressId', CheckClientSessionMiddleware(), UserControllers.UpdateUserAddressController);
UserRouter.get('/address/list', CheckClientSessionMiddleware(), UserControllers.GetUserAddressListController);
UserRouter.delete('/address/remove/:addressId', CheckClientSessionMiddleware(), UserControllers.RemoveUserAddressController);

UserRouter.put('/profile/info', CheckClientSessionMiddleware(), UserControllers.UpdateUserInfoController);
UserRouter.put('/profile/fcm-token', CheckClientSessionMiddleware(), UserControllers.UpdateUserFcmTokenController);
UserRouter.put('/profile/avatar', CheckClientSessionMiddleware(), UserControllers.UpdateUserAvatarController);
UserRouter.get('/profile/detail', CheckClientSessionMiddleware(), UserControllers.GetUserProfileController);
UserRouter.delete('/profile', CheckClientSessionMiddleware(), UserControllers.DeleteAccountController);

UserRouter.get('/cashback/list', CheckClientSessionMiddleware(), UserControllers.GetUserCashbackController);
UserRouter.post('/cashback/list', CheckClientSessionMiddleware(), UserControllers.GetUserCashbacksController);