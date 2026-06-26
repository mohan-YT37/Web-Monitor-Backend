// src/permissions/permissions.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Menu } from '../menus/entities/menu.entity';
import { RolePermission } from './entities/role-permission.entity';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Menu) private menuRepo: Repository<Menu>,
    @InjectRepository(RolePermission)
    private rolePermissionRepo: Repository<RolePermission>,
  ) { }
  
    // Simple recursive function to build menu tree with permissions
  private buildMenuTree(
    menus: Menu[],
    permissions: RolePermission[],
    parentId: number | null = null,
  ): any[] {
    return menus
      .filter((menu) => menu.parent_id === parentId)
      .map((menu) => {
        // Find permission by searching the array
        const perm = permissions.find((p) => p.menu_id === menu.id);

        const node: any = {
          id: menu.id,
          key: menu.key,
          label: menu.label,
          path: menu.path,
          icon: menu.icon,
          permissions: {
            view: perm?.view ?? 0,
            create: perm?.create ?? 0,
            edit: perm?.edit ?? 0,
            delete: perm?.delete ?? 0,
          },
        };

        const children = this.buildMenuTree(menus, permissions, menu.id);
        if (children.length > 0) {
          node.children = children;
        }

        return node;
      });
  }

  // Check if a role has specific permission for a module
  async hasPermission(
    roleValue: string,
    moduleKey: string,
    action: PermissionAction,
  ): Promise<boolean> {
    if (!roleValue || !moduleKey || !action) return false;

    // Super admin always has full access
    if (roleValue === 'super_admin') return true;

    const role = await this.roleRepo.findOne({ where: { value: roleValue } });
    if (!role) return false;

    const menu = await this.menuRepo.findOne({ where: { key: moduleKey } });
    if (!menu) return false;

    const permission = await this.rolePermissionRepo.findOne({
      where: { role_id: role.id, menu_id: menu.id },
    });

    return permission?.[action] === 1;
  }

  // Assign default permissions when a new role is created
  async assignDefaultPermissions(role: Role) {
    const isSuperAdmin = role.value === 'super_admin';
    const allMenus = await this.menuRepo.find({ where: { active: 1 } });

    // Define which menus get default view access for non-super-admin roles
    const defaultViewOnlyKeys = ['dashboard', 'monitor', 'passwords'];

    const rows = allMenus
      .filter((menu) => isSuperAdmin || defaultViewOnlyKeys.includes(menu.key))
      .map((menu) =>
        this.rolePermissionRepo.create({
          role_id: role.id,
          menu_id: menu.id,
          view: 1,
          create: isSuperAdmin ? 1 : 0,
          edit: isSuperAdmin ? 1 : 0,
          delete: isSuperAdmin ? 1 : 0,
        }),
      );

    if (rows.length) {
      await this.rolePermissionRepo.save(rows);
    }
  }

  // Add/update permissions for a role (used in role-edit screen)
  async upsertPermissions(
    role: Role,
    items: {
      menu_public_id: string;
      view: number;
      create: number;
      edit: number;
      delete: number;
    }[],
  ) {
    for (const item of items) {
      const menu = await this.menuRepo.findOne({
        where: { public_id: item.menu_public_id },
      });
      if (!menu) continue;

      let permission = await this.rolePermissionRepo.findOne({
        where: { role_id: role.id, menu_id: menu.id },
      });

      if (!permission) {
        permission = this.rolePermissionRepo.create({
          role_id: role.id,
          menu_id: menu.id,
        });
      }

      permission.view = item.view ?? 0;
      permission.create = item.create ?? 0;
      permission.edit = item.edit ?? 0;
      permission.delete = item.delete ?? 0;

      await this.rolePermissionRepo.save(permission);
    }
  }

  // Build nested menu tree with permissions for login response
  async buildMenuTreeWithRolePermissions(roleValue: string) {
    const role = await this.roleRepo.findOne({ where: { value: roleValue } });
    if (!role) return [];

    // Get all permissions for this role
    const permissions = await this.rolePermissionRepo.find({
      where: { role_id: role.id },
    });

    // Get all active menus
    const allMenus = await this.menuRepo.find({
      where: { active: 1 },
      order: { sort_order: 'ASC' },
    });

    // Build the tree
    return this.buildMenuTree(allMenus, permissions);
  }

}
