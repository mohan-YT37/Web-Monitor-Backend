export type FolderAccess = 'view' | 'edit';

export interface FolderPermissionEntry {
  user_id: number;
  access: FolderAccess;
  user_name: string;
}
