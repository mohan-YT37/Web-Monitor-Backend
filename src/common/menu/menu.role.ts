export const MENU_BY_ROLE = {
  super_admin: {
    dashboard: { view: 1, create: 1, edit: 1, delete: 1 },
    monitor: { view: 1, create: 1, edit: 1, delete: 1 },
    incidents: { view: 1, create: 1, edit: 1, delete: 1 },
    statusPages: { view: 1, create: 1, edit: 1, delete: 1 },
    users: { view: 1, create: 1, edit: 1, delete: 1 },
    settings: {
      view: 1,
      create: 1,
      edit: 1,
      delete: 1,

      children: {
        client: { view: 1, create: 1, edit: 1, delete: 1 },
        employee: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },
  },
};
