
import { Action } from '../enum/action.enum';
import { MENU_BY_ROLE } from '../menu/menu.role';

export const hasPermission = (
  role: string,
  module: string,
  action: keyof typeof Action,
) => {
  return MENU_BY_ROLE?.[role]?.[module]?.[action] === 1;
};
