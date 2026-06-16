import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee } from './entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { CatchError } from '../common/response/catch-error.util';
import {
  successResponse,
  errorResponse,
} from '../common/response/response.util';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { instanceToPlain } from 'class-transformer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private deleteOldFile(filePath: string | null) {
    if (!filePath) return;

    try {
      const urlParts = filePath.split('/');
      const filename = urlParts[urlParts.length - 1];

      const localPath = path.join(
        process.cwd(),
        'uploads',
        'employee-documents',
        filename,
      );

      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (error) {
      console.error('Error deleting old file:', error);
    }
  }

  async create(dto: CreateEmployeeDto, user: any) {
    try {
      // Check if email already exists in employee table
      const existingEmail = await this.employeeRepo.findOne({
        where: { email: dto.email },
      });

      if (existingEmail) {
        return errorResponse('Employee with this email already exists', 409);
      }

      // Check if mobile number already exists in employee table
      const existingMobile = await this.employeeRepo.findOne({
        where: { mobile_no: dto.mobile_no },
      });

      if (existingMobile) {
        return errorResponse(
          'Employee with this mobile number already exists',
          409,
        );
      }

      // Check if username already exists in employee table
      const existingUsername = await this.employeeRepo.findOne({
        where: { username: dto.username },
      });

      if (existingUsername) {
        return errorResponse('Username already exists in employee', 409);
      }

      // Check if username already exists in users table
      const existingUserUsername = await this.userRepo.findOne({
        where: { username: dto.username },
      });

      if (existingUserUsername) {
        return errorResponse('Username already exists in users', 409);
      }

      // Check if email already exists in users table
      const existingUserEmail = await this.userRepo.findOne({
        where: { email: dto.email },
      });

      if (existingUserEmail) {
        return errorResponse('Email already exists in users', 409);
      }

      // Validate bond fields
      if (dto.bond === true) {
        if (!dto.bond_start_date || !dto.bond_end_date) {
          return errorResponse(
            'Bond start date and end date are required when bond is true',
            400,
          );
        }

        if (new Date(dto.bond_end_date) <= new Date(dto.bond_start_date)) {
          return errorResponse(
            'Bond end date must be after bond start date',
            400,
          );
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // Create employee
      const { password: _pw, ...employeeData } = dto;
      const employee = this.employeeRepo.create({
        ...employeeData,
        password: hashedPassword,
        role: 'employee',
        created_by: user?.id,
      });

      const savedEmployee = await this.employeeRepo.save(employee);

      // Create user in users table
      const newUser = this.userRepo.create({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        role: 'employee',
        created_by: user?.id,
      });

      await this.userRepo.save(newUser);

      // Remove password from response
      const employeeWithoutPassword = instanceToPlain(savedEmployee);

      return successResponse(
        employeeWithoutPassword,
        'Employee created successfully',
        201,
      );
    } catch (error) {
      CatchError(error);
    }
  }

  async findAll(
    query?: {
      search?: string;
      filter?: string;
      sort?: string;
      page?: number;
      limit?: number;
    },
    user?: any,
  ) {
    try {
      const page = Number(query?.page) || 1;
      const limit = Number(query?.limit) || 10;

      const qb = this.employeeRepo.createQueryBuilder('employee');

      // Only show employees created by the logged-in user
      qb.andWhere('employee.created_by = :userId', {
        userId: user?.id,
      });

      // SEARCH
      if (query?.search) {
        qb.andWhere(
          `(
            employee.emp_name LIKE :search OR
            employee.email LIKE :search OR
            employee.mobile_no LIKE :search OR
            employee.department LIKE :search OR
            employee.username LIKE :search OR
            employee.current_role LIKE :search OR
            employee.father_name LIKE :search OR
            employee.joining_role LIKE :search
          )`,
          {
            search: `%${query.search}%`,
          },
        );
      }

      // FILTER
      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('employee.active = :active', { active: 1 });
            break;

          case 'INACTIVE':
            qb.andWhere('employee.active = :active', { active: 0 });
            break;

          case 'TEMPORARY':
            qb.andWhere('employee.employee_type = :type', {
              type: 'temporary',
            });
            break;

          case 'PERMANENT':
            qb.andWhere('employee.employee_type = :type', {
              type: 'permanent',
            });
            break;

          case 'BOND':
            qb.andWhere('employee.bond = :bond', { bond: true });
            break;
        }
      }

      // SORT
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('employee.emp_name', 'ASC');
            break;

          case 'Z_A':
            qb.orderBy('employee.emp_name', 'DESC');
            break;

          case 'OLDEST':
            qb.orderBy('employee.created_at', 'ASC');
            break;

          case 'NEWEST':
          default:
            qb.orderBy('employee.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('employee.created_at', 'DESC');
      }

      const [employees, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      if (!employees || employees.length === 0) {
        return successResponse([], 'No employees found', 200);
      }

      // Remove passwords from response
      const employeesWithoutPasswords = employees.map((employee) =>
        instanceToPlain(employee),
      );

      return successResponse(
        {
          data: employeesWithoutPasswords,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        'Employees fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { public_id, created_by: user?.id },
      });

      if (!employee) {
        return errorResponse('Employee not found', 404);
      }

      // Remove password from response
      const employeeWithoutPassword = instanceToPlain(employee);

      return successResponse(
        employeeWithoutPassword,
        'Employee fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async update(public_id: string, dto: UpdateEmployeeDto, user: any) {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { public_id, created_by: user?.id },
      });

      if (!employee) {
        return errorResponse('Employee not found', 404);
      }

      // Delete old document file if new document is uploaded
      if (dto.document && dto.document !== employee.document) {
        this.deleteOldFile(employee.document);
      }

      if (dto.document === '') {
        dto.document = null;
      }

      // Check if email is being updated and already exists
      if (dto.email && dto.email !== employee.email) {
        const existingEmail = await this.employeeRepo.findOne({
          where: { email: dto.email },
        });

        if (existingEmail) {
          return errorResponse('Employee with this email already exists', 409);
        }

        // Update email in users table
        const userRecord = await this.userRepo.findOne({
          where: { email: employee.email },
        });

        if (userRecord) {
          userRecord.email = dto.email;
          await this.userRepo.save(userRecord);
        }
      }

      // Check if mobile is being updated and already exists
      if (dto.mobile_no && dto.mobile_no !== employee.mobile_no) {
        const existingMobile = await this.employeeRepo.findOne({
          where: { mobile_no: dto.mobile_no },
        });

        if (existingMobile) {
          return errorResponse(
            'Employee with this mobile number already exists',
            409,
          );
        }
      }

      // Check if username is being updated and already exists
      if (dto.username && dto.username !== employee.username) {
        const existingUsername = await this.employeeRepo.findOne({
          where: { username: dto.username },
        });

        if (existingUsername) {
          return errorResponse('Username already exists in employee', 409);
        }

        const existingUserUsername = await this.userRepo.findOne({
          where: { username: dto.username },
        });

        if (existingUserUsername) {
          return errorResponse('Username already exists in users', 409);
        }

        // Update username in users table
        const userRecord = await this.userRepo.findOne({
          where: { username: employee.username },
        });

        if (userRecord) {
          userRecord.username = dto.username;
          await this.userRepo.save(userRecord);
        }
      }

      // Validate bond fields
      if (dto.bond === true) {
        const bondStartDate = dto.bond_start_date || employee.bond_start_date;
        const bondEndDate = dto.bond_end_date || employee.bond_end_date;

        if (!bondStartDate || !bondEndDate) {
          return errorResponse(
            'Bond start date and end date are required when bond is true',
            400,
          );
        }

        if (new Date(bondEndDate) <= new Date(bondStartDate)) {
          return errorResponse(
            'Bond end date must be after bond start date',
            400,
          );
        }
      }

      // If password is being updated, hash it and update in users table
      if (dto.password) {
        dto.password = await bcrypt.hash(dto.password, 10);

        const userRecord = await this.userRepo.findOne({
          where: { username: employee.username },
        });

        if (userRecord) {
          userRecord.password = dto.password;
          await this.userRepo.save(userRecord);
        }
      }

      Object.assign(employee, dto);
      employee.updated_by = user?.id;

      const updatedEmployee = await this.employeeRepo.save(employee);

      // Remove password from response
      const employeeWithoutPassword = instanceToPlain(updatedEmployee);

      return successResponse(
        employeeWithoutPassword,
        'Employee updated successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { public_id, created_by: user?.id },
      });

      if (!employee) {
        return errorResponse('Employee not found', 404);
      }

      // Delete document file
      this.deleteOldFile(employee.document);

      // Soft delete user from users table
      const userRecord = await this.userRepo.findOne({
        where: { username: employee.username },
      });

      if (userRecord) {
        userRecord.deleted_by = user?.id;
        await this.userRepo.save(userRecord);
        await this.userRepo.softDelete(userRecord.id);
      }

      // Soft delete employee
      employee.deleted_by = user?.id;
      await this.employeeRepo.save(employee);
      await this.employeeRepo.softDelete(employee.id);

      return successResponse(null, 'Employee deleted successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async bulkDelete(public_ids: string[], user: any) {
    try {
      if (!public_ids || !public_ids.length) {
        return errorResponse('No employee IDs provided', 400);
      }

      const employees = await this.employeeRepo.find({
        where: {
          public_id: In(public_ids),
          created_by: user?.id,
        },
      });

      if (!employees.length) {
        return errorResponse('No employees found with provided IDs', 404);
      }

      // Get all usernames to delete from users table
      const usernames = employees.map((emp) => emp.username);

      // Find and soft delete users
      const users = await this.userRepo.find({
        where: { username: In(usernames) },
      });

      if (users.length) {
        for (const userRecord of users) {
          userRecord.deleted_by = user?.id;
        }
        await this.userRepo.save(users);
        await this.userRepo.softDelete(users.map((u) => u.id));
      }

      // Soft delete employees
      const ids = employees.map((emp) => emp.id);
      for (const employee of employees) {
        employee.deleted_by = user?.id;
      }
      await this.employeeRepo.save(employees);
      await this.employeeRepo.softDelete(ids);

      return successResponse(
        { deleted: employees.length },
        'Employees deleted successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  async getFilters() {
    return successResponse(
      [
        { value: '', label: 'All' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' },
        { value: 'TEMPORARY', label: 'Temporary' },
        { value: 'PERMANENT', label: 'Permanent' },
        { value: 'BOND', label: 'Bond' },
      ],
      'Filter options fetched successfully',
      200,
    );
  }

  async getSorts() {
    return successResponse(
      [
        { value: 'A_Z', label: 'A to Z' },
        { value: 'Z_A', label: 'Z to A' },
        { value: 'NEWEST', label: 'Newest First' },
        { value: 'OLDEST', label: 'Oldest First' },
      ],
      'Sort options fetched successfully',
      200,
    );
  }
}
