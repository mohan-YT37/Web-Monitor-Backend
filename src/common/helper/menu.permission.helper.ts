import { Action } from '../enum/action.enum';
import { MENU_BY_ROLE } from '../menu/menu.role';

const findModuleConfig = (node: any, module: string): any => {
  if (!node || typeof node !== 'object') return undefined;

  if (node[module] && typeof node[module] === 'object') {
    return node[module];
  }

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === 'object') {
      const found = findModuleConfig(val, module);
      if (found) return found;
    }
  }

  return undefined;
};

export const hasPermission = (
  role: string,
  module: string,
  action: keyof typeof Action,
): boolean => {
  if (!role || !module || !action) return false;

  const normalizedRole = role.toLowerCase();
  const roleConfig = MENU_BY_ROLE?.[normalizedRole];
  if (!roleConfig) return false;

  const moduleConfig = findModuleConfig(roleConfig, module);
  if (!moduleConfig) return false;

  return moduleConfig[action] === 1;
};
  