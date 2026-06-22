export const LogAction = {
  viewed: 'viewed',
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  copied: 'copied',
  shared_link: 'shared_link',
  shared_users: 'shared_users',
  moved: 'moved',
} as const;

export type LogAction = (typeof LogAction)[keyof typeof LogAction];

export const LogResourceType = {
  item: 'item',
  folder: 'folder',
} as const;

export type LogResourceType = (typeof LogResourceType)[keyof typeof LogResourceType];