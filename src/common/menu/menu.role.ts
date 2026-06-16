export const MENU_BY_ROLE = {
  super_admin: {
    dashboard: { view: 1, create: 1, edit: 1, delete: 1 },
    monitor: { view: 1, create: 1, edit: 1, delete: 1 },
    users: { view: 1, create: 1, edit: 1, delete: 1 },
    settings: {
      view: 1,
      create: 1,
      edit: 1,
      delete: 1,
      children: {
        client: { view: 1, create: 1, edit: 1, delete: 1 },
        employee: { view: 1, create: 1, edit: 1, delete: 1 },
        passwordmanager: { view: 1, create: 1, edit: 1, delete: 1 },
        folders: { view: 1, create: 1, edit: 1, delete: 1 },
        items: { view: 1, create: 1, edit: 1, delete: 1 },
        share: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },
  },

  admin: {
    dashboard: { view: 1, create: 0, edit: 0, delete: 0 },
    monitor: { view: 1, create: 1, edit: 1, delete: 0 },
    users: { view: 1, create: 0, edit: 0, delete: 0 },
    settings: {
      view: 1,
      create: 0,
      edit: 0,
      delete: 0,
      children: {
        client: { view: 1, create: 0, edit: 0, delete: 0 },
        employee: { view: 1, create: 1, edit: 1, delete: 0 },
        passwordmanager: { view: 1, create: 1, edit: 1, delete: 0 },
        folders: { view: 1, create: 1, edit: 1, delete: 0 }, 
        items: { view: 1, create: 1, edit: 1, delete: 0 }, 
        share: { view: 1, create: 1, edit: 0, delete: 0 }, 
      },
    },
  },

  employee: {
    dashboard: { view: 1, create: 0, edit: 0, delete: 0 },
    monitor: { view: 1, create: 0, edit: 0, delete: 0 },
    users: { view: 0, create: 0, edit: 0, delete: 0 },
    settings: {
      view: 1,
      create: 0,
      edit: 0,
      delete: 0,
      children: {
        client: { view: 0, create: 0, edit: 0, delete: 0 },
        employee: { view: 0, create: 0, edit: 0, delete: 0 },
        passwordmanager: { view: 1, create: 1, edit: 1, delete: 0 },
        folders: { view: 1, create: 1, edit: 1, delete: 1 },
        items: { view: 1, create: 1, edit: 1, delete: 1 },
        share: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },
  },
};
