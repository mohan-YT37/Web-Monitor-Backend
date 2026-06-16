// employee.entity.ts
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Exclude, Transform } from 'class-transformer';

@Entity('employees')
export class Employee {
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

  @Column({ type: 'varchar', length: 120 })
  emp_name!: string;

  @Column({ type: 'varchar', length: 120 })
  father_name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emp_blood_group!: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth!: Date;

  @Column({ type: 'date', nullable: true })
  joining_date!: Date;

  @Column({ type: 'date', nullable: true })
  relieve_date!: Date;

  @Column({ type: 'varchar', length: 150, nullable: true })
  qualification!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  joining_role!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  current_role!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  group_name!: string;

  @Column({ type: 'text', nullable: true })
  address!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  mobile_no!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergency_contact!: string;

  @Column({ type: 'decimal', default: 0 })
  joining_salary!: number;

  @Column({ type: 'decimal', default: 0 })
  current_salary!: number;

  @Column({ default: false })
  bond!: boolean;

  @Column({ type: 'date', nullable: true })
  bond_start_date!: Date;

  @Column({ type: 'date', nullable: true })
  bond_end_date!: Date;

  @Column({ default: false })
  return_document!: boolean;

  @Column({ type: 'int', default: 0 })
  allowed_leave_days!: number;

  @Column({
    type: 'enum',
    enum: ['temporary', 'permanent'],
    default: 'temporary',
  })
  employee_type!: 'temporary' | 'permanent';

  @Column({ type: 'varchar', length: 100, unique: true })
  username!: string;

  @Transform(({ value }) => (value === 'null' ? null : value))
  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password!: string | null;

  @Column({
    type: 'varchar',
    default: 'employee',
  })
  role!: string;

  @Column({ type: 'text', nullable: true })
  document!: string | null;

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
