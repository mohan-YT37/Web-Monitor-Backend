// menu.master.ts
export const MENU_MASTER = {
  dashboard: {
    id: 1,
    key: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: 'LayoutDashboard',
  },
  monitor: {
    id: 2,
    key: 'monitor',
    label: 'Monitor',
    path: '/monitor',
    icon: 'Monitor',
  },
  users: {
    id: 3,
    key: 'users',
    label: 'Users',
    path: '/users',
    icon: 'Users',
  },
  settings: {
    id: 4,
    key: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    children: [
      {
        id: 41,
        key: 'client',
        label: 'Client',
        path: '/settings/client',
        icon: 'Building2',
      },

      {
        id: 42,
        key: 'employee',
        label: 'Employee',
        path: '/settings/employee',
        icon: 'UserCog',
      },
      {
        id: 43,
        key: 'passwordmanager',
        label: 'Password Magaer',
        path: '/settings/password-manager',
        icon: 'KeyRound',
      },
    ],
  },
};
