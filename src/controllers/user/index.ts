import RemoveLikeFromProductController from './favorite/RemoveLikeFromProduct.controller';
import SetLikeToProductController from './favorite/SetLikeToProduct.controller';
import GetUserBasketController from './basket/GetUserBasket.controller';
import PutProductToBasketController from './basket/PutProductToBasket.controller';
import RemoveProductFromBasketController from './basket/RemoveProductFromBasket.controller';
import UpdateProductCountInBasketController from './basket/UpdateProductCountInBasket.controller';
import AddUserAddressController from './address/AddUserAddress.controller';
import GetUserAddressListController from './address/GetUserAddressList.controller';
import RemoveUserAddressController from './address/RemoveUserAddress.controller';
import GetUserProfileController from './profile/GetUserProfile.controller';
import UpdateUserAvatarController from './profile/UpdateUserAvatar.controller';
import UpdateUserInfoController from './profile/UpdateUserInfo.controller';
import UpdateUserAddressController from './address/UpdateUserAddress.controller';
import DeleteAccountController from './profile/DeleteAccount.controller';
import UpdateUserFcmTokenController from './profile/UpdateUserFcmToken.controller';
import GetUserCashbackController from './user-cashback/GetUserCashback.controller';
import GetUserCashbacksController from './user-cashback/GetUserCashbacks.controller';
import GetMyFavoriteProductsController from './favorite/GetMyFavoriteProducts.controller';

export const UserControllers = {
  RemoveLikeFromProductController: RemoveLikeFromProductController.controller,
  SetLikeToProductController: SetLikeToProductController.controller,
  GetUserBasketController: GetUserBasketController.controller,
  PutProductToBasketController: PutProductToBasketController.controller,
  RemoveProductFromBasketController: RemoveProductFromBasketController.controller,
  UpdateProductCountInBasketController: UpdateProductCountInBasketController.controller,
  AddUserAddressController: AddUserAddressController.controller,
  GetUserAddressListController: GetUserAddressListController.controller,
  RemoveUserAddressController: RemoveUserAddressController.controller,
  GetUserProfileController: GetUserProfileController.controller,
  UpdateUserAvatarController: UpdateUserAvatarController.controller,
  UpdateUserInfoController: UpdateUserInfoController.controller,
  UpdateUserFcmTokenController: UpdateUserFcmTokenController.controller,
  UpdateUserAddressController: UpdateUserAddressController.controller,
  DeleteAccountController: DeleteAccountController.controller,
  GetUserCashbackController: GetUserCashbackController.controller,
  GetUserCashbacksController: GetUserCashbacksController.controller,
  GetMyFavoriteProductsController: GetMyFavoriteProductsController.controller,
};
