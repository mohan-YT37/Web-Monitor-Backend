import { Optional } from '@nestjs/common';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 50 })
  public_id!: string;

  @BeforeInsert()
  generatePublicId() {
    if (!this.public_id) {
      this.public_id = uuidv4().replace(/-/g, '');
    }
  }

  @Column({ type: 'varchar', length: 50, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  path!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon!: string;

  @Column({ type: 'int', nullable: true })
  parent_id!: number | null;

  @ManyToOne(() => Menu, (menu) => menu.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: Menu;

  @OneToMany(() => Menu, (menu) => menu.parent)
  children!: Menu[];

  @Column({ type: 'int', default: 0 })
  @Optional()
  sort_order!: number;

  @Column({ default: 1 })
  active!: number;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ nullable: true })
  created_by!: number;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ nullable: true })
  updated_by!: number;

  @DeleteDateColumn()
  deleted_at!: Date;

  @Column({ nullable: true })
  deleted_by!: number;
}
