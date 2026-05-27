import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';

import { v4 as uuidv4 } from 'uuid';

@Entity('clients')
export class Client {
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

  // Client Details
  @Column({ type: 'varchar', length: 100 })
  client_name!: string;

  @Column({ type: 'varchar', length: 150 })
  company_name!: string;

  // Emails
  @Column({ type: 'varchar', length: 120 })
  email_1!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email_2!: string;

  // Mobile Numbers
  @Column({ type: 'varchar', length: 20 })
  mobile_no_1!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile_no_2!: string;

  // Contact
  @Column({ type: 'varchar', length: 100 })
  contact_person!: string;

  @Column({ type: 'varchar', length: 50 })
  contact_type!: string;

  // Status
  @Column({ default: 1 })
  active!: number;

  // Created
  @CreateDateColumn()
  created_at!: Date;

  @Column({ nullable: true })
  created_by!: number;

  // Updated
  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ nullable: true })
  updated_by!: number;

  // Deleted
  @DeleteDateColumn()
  deleted_at!: Date;

  @Column({ nullable: true })
  deleted_by!: number;
}
