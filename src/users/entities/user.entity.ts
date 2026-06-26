import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';

import { v4 as uuidv4 } from 'uuid';

@Entity('users')
export class User {
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

  @Column({ type: 'varchar', length: 20 })
  username!: string;

  @Column({ nullable: true })
  profile_img!: string;

  @Column({ type: 'json', nullable: true })
  old_profile_img!: string[];

  @Column({ type: 'varchar', length: 50 })
  email!: string;

  @Column({ type: 'varchar', length: 100 })
  password!: string;

  @Column({ default: 'super_admin' })
  role!: string;
  
  @Column({ type: 'varchar', length: 100, nullable: true })
  otp!: string | null;

  @Column({ type: 'datetime', nullable: true })
  otp_expire_at!: Date | null;

  @Column({ default: false })
  otp_verified!: boolean;

  @Column({ nullable: true })
  refresh_token!: string;

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
