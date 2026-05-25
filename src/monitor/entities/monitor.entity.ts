import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  BeforeInsert,
  CreateDateColumn,
} from 'typeorm';
import { MonitorHistory } from './monitor-history.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('monitors')
export class Monitor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 30 })
  public_id!: string;

  @BeforeInsert()
  generatePublicId() {
    this.public_id = uuidv4().replace(/-/g, '').slice(0, 30);
  }

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  url!: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status!: string;

  @Column({ type: 'boolean', default: false })
  paused!: boolean;

  @Column({ type: 'int', default: 5 })
  interval!: number;

  @Column({ type: 'int', default: 5 })
  retry_count!: number;

  @Column({ type: 'int', default: 5 })
  timeout!: number;

  @Column({ type: 'int', nullable: true })
  response_time!: number;

  @Column({ type: 'int', nullable: true })
  avg_response!: number;

  @Column({ type: 'int', nullable: true })
  min_response!: number;

  @Column({ type: 'int', nullable: true })
  max_response!: number;

  @Column({ type: 'int', nullable: true })
  ping_response!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  uptime_percentage!: number;

  @Column({ type: 'int', default: 0 })
  total_checks!: number;

  @Column({ type: 'int', default: 0 })
  success_checks!: number;

  @Column({ type: 'int', default: 0 })
  failed_checks!: number;

  @Column({ type: 'varchar', nullable: true })
  ssl_expiry_date!: string;

  @Column({ type: 'text', nullable: true })
  validation_error!: string;

  @Column({ type: 'varchar', nullable: true })
  valid_from!: string;

  @Column({ type: 'int', nullable: true })
  ssl_days_left!: number;

  @Column({ type: 'varchar', nullable: true })
  domain_expiry_date!: string;

  @Column({ type: 'int', nullable: true })
  domain_days_left!: number;

  @Column({ type: 'varchar', nullable: true })
  domain_status!: string;

  @Column({ type: 'boolean', default: true })
  ssl_enabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  ssl_status!: string;

  @Column({ type: 'boolean', default: true })
  domain_enabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  last_checked!: string;

  @Column({ type: 'text', nullable: true })
  last_error!: string;

  @Column({ type: 'varchar', nullable: true })
  ip_address!: string;

  @Column({ type: 'varchar', nullable: true })
  last_down_at!: string;

  @Column({ type: 'varchar', nullable: true })
  last_up_at!: string;

  @Column({ type: 'varchar', nullable: true })
  notification_type!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notification_email!: string;

  @OneToMany(() => MonitorHistory, (history) => history.monitor, {
    cascade: true,
  })
  history!: MonitorHistory[];
}
