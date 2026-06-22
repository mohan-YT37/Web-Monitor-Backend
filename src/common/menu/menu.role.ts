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
      },
    },

    passwords: {
      view: 1,
      create: 1,
      edit: 1,
      delete: 1,
      children: {
        passwordmanager: { view: 1, create: 1, edit: 1, delete: 1 },
        logs: { view: 1, create: 1, edit: 1, delete: 1 },
        folders: { view: 1, create: 1, edit: 1, delete: 1 },
        items: { view: 1, create: 1, edit: 1, delete: 1 },
        share: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },

    masters: {
      view: 1,
      create: 1,
      edit: 1,
      delete: 1,
      children: {
        tags: { view: 1, create: 1, edit: 1, delete: 1 },
        role: { view: 1, create: 1, edit: 1, delete: 1 },
        department: { view: 1, create: 1, edit: 1, delete: 1 },
        group: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },
  },

  manager: {
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
      },
    },

    passwords: {
      view: 1,
      create: 1,
      edit: 1,
      delete: 0,
      children: {
        passwordmanager: { view: 1, create: 1, edit: 1, delete: 0 },
        logs: { view: 1, create: 0, edit: 0, delete: 0 },
        folders: { view: 1, create: 1, edit: 1, delete: 1 },
        items: { view: 1, create: 1, edit: 1, delete: 1 },
        share: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },

    masters: {
      view: 1,
      create: 0,
      edit: 0,
      delete: 0,
      children: {
        tags: { view: 1, create: 0, edit: 0, delete: 0 },
        role: { view: 1, create: 0, edit: 0, delete: 0 },
        department: { view: 1, create: 0, edit: 0, delete: 0 },
        group: { view: 1, create: 0, edit: 0, delete: 0 },
      },
    },
  },

  employee: {
    dashboard: { view: 1, create: 0, edit: 0, delete: 0 },
    monitor: { view: 1, create: 0, edit: 0, delete: 0 },
    users: { view: 0, create: 0, edit: 0, delete: 0 },

    settings: {
      view: 0,
      create: 0,
      edit: 0,
      delete: 0,
      children: {
        client: { view: 0, create: 0, edit: 0, delete: 0 },
        employee: { view: 0, create: 0, edit: 0, delete: 0 },
      },
    },

    passwords: {
      view: 1,
      create: 0,
      edit: 0,
      delete: 0,
      children: {
        passwordmanager: { view: 1, create: 1, edit: 1, delete: 0 },
        logs: { view: 0, create: 0, edit: 0, delete: 0 },
        folders: { view: 1, create: 1, edit: 1, delete: 1 },
        items: { view: 1, create: 1, edit: 1, delete: 1 },
        share: { view: 1, create: 1, edit: 1, delete: 1 },
      },
    },

    masters: {
      view: 0,
      create: 0,
      edit: 0,
      delete: 0,
      children: {
        tags: { view: 0, create: 0, edit: 0, delete: 0 },
        role: { view: 0, create: 0, edit: 0, delete: 0 },
        department: { view: 0, create: 0, edit: 0, delete: 0 },
        group: { view: 0, create: 0, edit: 0, delete: 0 },
      },
    },
  },
};
