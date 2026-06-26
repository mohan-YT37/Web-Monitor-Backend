import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CatchError } from 'src/common/response/catch-error.util';
import {
  errorResponse,
  successResponse,
} from 'src/common/response/response.util';
import { MANUAL_MENU_MASTER } from 'src/common/menu/menu.master';

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(Menu)
    private menuRepo: Repository<Menu>,
  ) {}

  private buildMenuTree(menus: Menu[], parentId: number | null = null): any[] {
    return (
      menus
        // Step 1: Find menus that belong to the current parent
        .filter((menu) => menu.parent_id === parentId)

        // Step 2: For each menu, build its children recursively
        .map((menu) => ({
          public_id: menu.public_id,
          key: menu.key,
          label: menu.label,
          path: menu.path,
          icon: menu.icon,
          sort_order: menu.sort_order,
          // Step 3: Recursively find children of this menu
          children: this.buildMenuTree(menus, menu.id),
        }))
    );
  }

  async create(dto: CreateMenuDto, user: any) {
    try {
      let parent: Menu | null = null;

      if (dto.parent_public_id) {
        parent = await this.menuRepo.findOne({
          where: { public_id: dto.parent_public_id },
        });
        if (!parent) return errorResponse('Parent menu not found', 404);
      }

      const existing = await this.menuRepo.findOne({ where: { key: dto.key } });
      if (existing)
        return errorResponse('Menu with this key already exists', 409);

      // Auto-calculate sort_order
      let sortOrder: number;

      if (parent) {
        // For child menus: count existing children of the same parent + 1
        const childCount = await this.menuRepo.count({
          where: { parent_id: parent.id },
        });
        sortOrder = childCount + 1;
      } else {
        // For parent menus (main menus): count root menus + 1
        const rootCount = await this.menuRepo.count({
          where: { parent_id: IsNull() },
        });
        sortOrder = rootCount + 1;
      }

      const menu = this.menuRepo.create({
        key: dto.key,
        label: dto.label,
        path: dto.path,
        icon: dto.icon,
        parent_id: parent ? parent.id : null,
        sort_order: sortOrder,
        created_by: user?.id,
      });

      const saved = await this.menuRepo.save(menu);
      return successResponse(saved, 'Menu created successfully', 201);
    } catch (error) {
      return CatchError(error);
    }
  }

  async findTree() {
    try {
      const allMenus = await this.menuRepo.find({
        where: { active: 1 },
        order: { sort_order: 'ASC' },
      });
      console.log(allMenus);
      
      if(allMenus?.length <= 0) return errorResponse("Menus Not Found",404)
      const tree = this.buildMenuTree(allMenus);



      return successResponse(tree, 'Menu tree fetched successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async findOne(public_id: string) {
    try {
      const menu = await this.menuRepo.findOne({ where: { public_id } });
      if (!menu) return errorResponse('Menu not found', 404);
      return successResponse(menu, 'Menu fetched successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async update(public_id: string, dto: UpdateMenuDto, user: any) {
    try {
      const menu = await this.menuRepo.findOne({ where: { public_id } });
      if (!menu) return errorResponse('Menu not found', 404);

      if (dto.parent_public_id) {
        const parent = await this.menuRepo.findOne({
          where: { public_id: dto.parent_public_id },
        });
        if (!parent) return errorResponse('Parent menu not found', 404);
        menu.parent_id = parent.id;

        // If parent changed, auto-calculate new sort_order
        if (dto.parent_public_id && menu.parent_id !== parent.id) {
          const childCount = await this.menuRepo.count({
            where: { parent_id: parent.id },
          });
          menu.sort_order = childCount + 1;
        }
      }

      if (dto.key && dto.key !== menu.key) {
        const existing = await this.menuRepo.findOne({
          where: { key: dto.key },
        });
        if (existing)
          return errorResponse('Menu with this key already exists', 409);
        menu.key = dto.key;
      }

      menu.label = dto.label ?? menu.label;
      menu.path = dto.path ?? menu.path;
      menu.icon = dto.icon ?? menu.icon;

      // Only update sort_order if explicitly provided (for manual reordering)
      if (dto.sort_order !== undefined) {
        menu.sort_order = dto.sort_order;
      }

      menu.updated_by = user?.id;

      const updated = await this.menuRepo.save(menu);
      return successResponse(updated, 'Menu updated successfully', 200);
    } catch (error) {
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const menu = await this.menuRepo.findOne({ where: { public_id } });
      if (!menu) return errorResponse('Menu not found', 404);

      await this.removeRecursive(menu.id, user?.id);
      return successResponse(null, 'Menu deleted successfully', 204);
    } catch (error) {
      return CatchError(error);
    }
  }

  private async removeRecursive(menuId: number, userId: number) {
    const children = await this.menuRepo.find({ where: { parent_id: menuId } });
    for (const child of children) {
      await this.removeRecursive(child.id, userId);
    }
    await this.menuRepo.update(menuId, { deleted_by: userId });
    await this.menuRepo.softDelete(menuId);
  }

  // Run once via Postman (POST /menus/seed) to migrate your static MENU_MASTER into the DB
  async seed(user: any) {
    try {
      const seedData = Array.isArray(MANUAL_MENU_MASTER)
        ? MANUAL_MENU_MASTER
        : [];
      let addedCount = 0;

      let rootSortOrder =
        (await this.menuRepo.count({ where: { parent_id: IsNull() } })) + 1;

      for (const item of seedData) {
        const { children, ...parentData } = item;

        let parentMenu = await this.menuRepo.findOne({
          where: { key: parentData.key },
        });

        if (!parentMenu) {
          parentMenu = this.menuRepo.create({
            ...parentData,
            sort_order: rootSortOrder++,
            created_by: user?.id,
          });
          parentMenu = await this.menuRepo.save(parentMenu);
          addedCount++;
        }

        if (children?.length) {
          let childSortOrder =
            (await this.menuRepo.count({
              where: { parent_id: parentMenu.id },
            })) + 1;

          for (const c of children) {
            const existingChild = await this.menuRepo.findOne({
              where: { key: c.key },
            });
            if (!existingChild) {
              const childMenu = this.menuRepo.create({
                ...c,
                parent_id: parentMenu.id,
                sort_order: childSortOrder++,
                created_by: user?.id,
              });
              await this.menuRepo.save(childMenu);
              addedCount++;
            }
          }
        }
      }

      if (addedCount === 0) {
        return successResponse(
          null,
          'No new menus to add, already up to date',
          200,
        );
      }

      return successResponse(
        null,
        `${addedCount} new menu(s) seeded successfully`,
        201,
      );
    } catch (error) {
      return CatchError(error);
    }
  }
}
