import { MENU_MASTER } from "./menu.master";
import { MENU_BY_ROLE } from "./menu.role";

export const getMenuByRole = (role: string) => {
  const rolePermissions = MENU_BY_ROLE[role] || {};

  return Object.keys(rolePermissions).map((key) => {
    const menu = MENU_MASTER[key];
    const permission = rolePermissions[key];

    return {
      ...menu,

      permissions: {
        view: permission?.view ?? 0,
        create: permission?.create ?? 0,
        edit: permission?.edit ?? 0,
        delete: permission?.delete ?? 0,
      },

      children: menu?.children?.map((child) => ({
        ...child,

        permissions: {
          view: permission?.children?.[child.key]?.view ?? 0,
          create: permission?.children?.[child.key]?.create ?? 0,
          edit: permission?.children?.[child.key]?.edit ?? 0,
          delete: permission?.children?.[child.key]?.delete ?? 0,
        },
      })),
    };
  });
};
