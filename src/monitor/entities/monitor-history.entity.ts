import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

import { Monitor } from '../../monitor/entities/monitor.entity';

@Entity('monitor_history')
export class MonitorHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Monitor, (monitor) => monitor.history, {
    onDelete: 'CASCADE',
  })
  monitor!: Monitor;

  @Column()
  status!: string;

  @Column({
    nullable: true,
  })
  response_time!: number;

  @CreateDateColumn()
  created_at!: Date;
}
