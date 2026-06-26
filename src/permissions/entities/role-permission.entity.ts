import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Menu } from '../../menus/entities/menu.entity';

@Entity('role_permissions')
@Unique(['role_id', 'menu_id'])
export class RolePermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  role_id!: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column()
  menu_id!: number;

  @ManyToOne(() => Menu, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_id' })
  menu!: Menu;

  @Column({ default: 0 })
  view!: number;

  @Column({ default: 0 })
  create!: number;

  @Column({ default: 0 })
  edit!: number;

  @Column({ default: 0 })
  delete!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
