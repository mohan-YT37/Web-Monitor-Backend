import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 6 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  isUsed!: boolean;

  @Column({ type: 'varchar', length: 50, default: 'forgot-password' })
  purpose!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ nullable: true })
  userId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
