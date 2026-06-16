import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
  OneToMany,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SharedResource } from './shared-resource.entity';
import { Item } from './item.entity';

@Entity('folders')
export class Folder {
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

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'json', nullable: true })
  permissions!: number[];

  @Column({ default: 1 })
  active!: number;

  @OneToMany(() => Item, (item) => item.folder)
  items!: Item[];

  @OneToMany(() => SharedResource, (shared) => shared.folder)
  shared_resources!: SharedResource[];

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
