import { CheckController } from './check';
import { SessionController } from './session';

export const AuthControllers = {
  CheckClientExistenceController: CheckController.CheckClientExistenceController,
  CreateSessionController: SessionController.CreateSessionController,
};
