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
  incidents: {
    id: 3,
    key: 'incidents',
    label: 'Incidents',
    path: '/incidents',
    icon: 'ShieldAlert',
  },
  statusPages: {
    id: 4,
    key: 'statusPages',
    label: 'Status Pages',
    path: '/status',
    icon: 'RadioTower',
  },
  users: {
    id: 5,
    key: 'users',
    label: 'Users',
    path: '/users',
    icon: 'Users',
  },
  settings: {
    id: 6,
    key: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    children: [
      {
        id: 61,
        key: 'client',
        label: 'Client',
        path: '/settings/client',
        icon: 'Building2',
      },

      {
        id: 62,
        key: 'employee',
        label: 'Employee',
        path: '/settings/employee',
        icon: 'UserCog',
      },
    ],
  },
};
