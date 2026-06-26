import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('tags')
export class Tag {
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

  @Column({ type: 'varchar', length: 100, })
  value!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

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

  @BeforeInsert()
  @BeforeUpdate()
  generateLabelAndValue() {
    if (!this.name) return;

    // Name
    this.name = this.name
      .replace(/[_-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Value
    this.value = this.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_') 
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_'); 
  }
}
