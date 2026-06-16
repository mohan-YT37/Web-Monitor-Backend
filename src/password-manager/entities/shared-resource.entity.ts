import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Folder } from './folder.entity';
import { Item } from './item.entity';

export interface SharedUserPermission {
  id: number;
  permission: 'view' | 'edit';
}

@Entity('shared_resources')
export class SharedResource {
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

  @Column({ type: 'enum', enum: ['folder', 'item'] })
  resource_type!: 'folder' | 'item';

  @Column({ nullable: true })
  folder_id!: number;

  @ManyToOne(() => Folder, (folder) => folder.shared_resources)
  @JoinColumn({ name: 'folder_id' })
  folder!: Folder;

  @Column({ nullable: true })
  item_id!: number;

  @ManyToOne(() => Item, (item) => item.shared_resources)
  @JoinColumn({ name: 'item_id' })
  item!: Item;

  @Column({ type: 'enum', enum: ['view', 'edit'] })
  permission_type!: 'view' | 'edit'; // Global / public default

  @Column({ type: 'enum', enum: ['personal', 'public'] })
  visibility!: 'personal' | 'public';

  @Column({ type: 'json', nullable: true })
  shared_with!: SharedUserPermission[];

  @Column({ type: 'varchar', length: 255, unique: true })
  share_token!: string;

  @Column({ default: false })
  is_otp_verified!: boolean;

  @Column({ type: 'varchar', length: 4, nullable: true })
  otp!: string;

  @Column({ type: 'datetime', nullable: true })
  otp_expire_at!: Date | null;

  /** Link expiry — null means never expires */
  @Column({ type: 'datetime', nullable: true })
  expires_at!: Date | null;

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
