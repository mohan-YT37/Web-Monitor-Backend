// entities/item.entity.ts
import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Folder } from './folder.entity';
import { SharedResource } from './shared-resource.entity';
import { FolderPermissionEntry } from '../interfaces/folder-permission.interface';

@Entity('items')
export class Item {
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

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 100 , nullable : true })
  username!: string;

  @Column({ type: 'varchar', length: 100 })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website!: string | null;

  @Column({ type: 'text' })
  password!: string;

  @Column({ type: 'json', nullable: true })
  custom_fields!: any[];

  @Column({ type: 'json', nullable: true })
  tags!: string[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ nullable: true })
  folder_id!: number;

  @ManyToOne(() => Folder, (folder) => folder.items, { nullable: true })
  @JoinColumn({ name: 'folder_id' })
  folder!: Folder;

  @Column({ type: 'json', nullable: true })
  permissions!: FolderPermissionEntry[];

  @Column({ type: 'int', nullable: true })
  shared_by!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  shared_at!: Date | null;

  @OneToMany(() => SharedResource, (shared) => shared.item)
  shared_resources!: SharedResource[];

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

  @Column('simple-array', { nullable: true })
  deleted_by_users!: number[];
}
