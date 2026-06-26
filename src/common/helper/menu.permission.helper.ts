// src/common/helper/menu.permission.helper.ts
import { Injectable } from '@nestjs/common';
import { PermissionsService } from 'src/permissions/permissions.service';


let permissionsServiceInstance: PermissionsService | null = null;

export const setPermissionsService = (service: PermissionsService) => {
  permissionsServiceInstance = service;
};

export const hasPermission = async (
  role: string,
  module: string,
  action: 'view' | 'create' | 'edit' | 'delete',
): Promise<boolean> => {
  // Super admin safety net
  if (role === 'super_admin') return true;
  
  if (!permissionsServiceInstance) {
    console.warn('PermissionsService not initialized, denying permission');
    return false;
  }
  
  return permissionsServiceInstance.hasPermission(role, module, action);
};

// Initialize the service in your main module
@Injectable()
export class PermissionHelperInitializer {
  constructor(private permissionsService: PermissionsService) {
    setPermissionsService(this.permissionsService);
  }
}