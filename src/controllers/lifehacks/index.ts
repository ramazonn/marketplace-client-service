import AddLifehackCommentController from "./AddLifehackComment.controller";
import AddLifehackLikeController from "./AddLifehackLike.controller";
import DeleteLifehackCommentController from "./DeleteLifehackComment.controller";
import GetLifehackCommentsListController from "./GetLifehackCommentList.controller";
import GetLifehackCommentRepliesController from "./GetLifehackCommentReplies.controller";
import GetLifehackDetailByIdController from "./GetLifehackDetailById.controller";
import GetLifehackLikesListController from "./GetLifehackLikeList.controller";
import GetLifehackListController from "./GetLifehackList.controller";

export const LifehackControllers = {
  GetLifehackDetailByIdController: GetLifehackDetailByIdController.controller,
  GetLifehackListController: GetLifehackListController.controller,


  AddLifehackCommentController: AddLifehackCommentController.controller,
  DeleteLifehackCommentController: DeleteLifehackCommentController.controller,
  GetLifehackCommentsListController: GetLifehackCommentsListController.controller,
  GetLifehackCommentRepliesController: GetLifehackCommentRepliesController.controller,



  GetLifehackLikesListController: GetLifehackLikesListController.controller,
  AddLifehackLikeController: AddLifehackLikeController.controller,

}
