import GetNotificationDetailController from "./GetNotificationDetail.controller";
import GetNotificationListController from "./GetNotificationList.controller";
import GetUnReadNotificationListController from "./UnReadNotification.controller";

export const NotificationControllers = {
  GetNotificationDetailController: GetNotificationDetailController.controller,
  GetNotificationListController: GetNotificationListController.controller,
  GetUnReadNotificationListController:  GetUnReadNotificationListController.controller
};