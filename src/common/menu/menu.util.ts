import { MENU_MASTER } from './menu.master';
import { MENU_BY_ROLE } from './menu.role';

export const getMenuByRole = (role: string) => {
  const rolePermissions = MENU_BY_ROLE[role] || {};

  return Object.keys(rolePermissions).map((key) => {
    const menu = MENU_MASTER[key];

    return {
      ...menu,
      permissions: {
        view: rolePermissions[key]?.view ?? 0,
        create: rolePermissions[key]?.create ?? 0,
        edit: rolePermissions[key]?.edit ?? 0,
        delete: rolePermissions[key]?.delete ?? 0,
      },
    };
  });
};
