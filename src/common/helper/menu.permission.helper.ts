import { Action } from '../enum/action.enum';
import { MENU_BY_ROLE } from '../menu/menu.role';

const SETTINGS_CHILDREN = [
  'client',
  'employee',
  'passwordmanager',
  'folders',
  'items',
  'share',
];

export const hasPermission = (
  role: string,
  module: string,
  action: keyof typeof Action,
): boolean => {
  if (!role || !module || !action) return false;

  // Normalize role to lowercase to avoid case mismatch
  const normalizedRole = role.toLowerCase();
  const roleConfig = MENU_BY_ROLE?.[normalizedRole];

  if (!roleConfig) return false;

  // Check settings.children for child modules
  if (SETTINGS_CHILDREN.includes(module)) {
    const childPerm = roleConfig?.settings?.children?.[module]?.[action];
    // If key exists, return its value; otherwise deny
    return childPerm === 1;
  }

  // Top-level module check
  return roleConfig?.[module]?.[action] === 1;
};
