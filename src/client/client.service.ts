import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';

import { Client } from './entities/client.entity';

import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

import { CatchError } from 'src/common/response/catch-error.util';

import {
  errorResponse,
  successResponse,
} from 'src/common/response/response.util';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  // CREATE
  async create(body: CreateClientDto, user: any) {
    try {
      const existingClient = await this.clientRepo.findOne({
        where: [{ email_1: body.email_1 }, { mobile_no_1: body.mobile_no_1 }],
      });

      if (existingClient) {
        return errorResponse(
          'Client already exists with email or mobile number',
          409,
        );
      }

      const newClient = this.clientRepo.create({
        ...body,
        created_by: user?.id,
      });

      const savedClient = await this.clientRepo.save(newClient);

      return successResponse(savedClient, 'Client created successfully', 201);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  // FIND ALL
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

      const qb = this.clientRepo.createQueryBuilder('client');

      // USER BASED DATA
      qb.andWhere('client.created_by = :userId', {
        userId: user?.id,
      });

      // SEARCH
      if (query?.search) {
        qb.andWhere(
          `
          (
            client.client_name LIKE :search OR
            client.company_name LIKE :search OR
            client.email_1 LIKE :search OR
            client.mobile_no_1 LIKE :search OR
            client.contact_person LIKE :search
          )
        `,
          {
            search: `%${query.search}%`,
          },
        );
      }

      // FILTER
      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'ACTIVE':
            qb.andWhere('client.active = :active', {
              active: 1,
            });
            break;

          case 'INACTIVE':
            qb.andWhere('client.active = :active', {
              active: 0,
            });
            break;
        }
      }

      // SORT
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('client.client_name', 'ASC');
            break;

          case 'Z_A':
            qb.orderBy('client.client_name', 'DESC');
            break;

          case 'OLDEST':
            qb.orderBy('client.created_at', 'ASC');
            break;

          case 'NEWEST':
          default:
            qb.orderBy('client.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('client.created_at', 'DESC');
      }

      // SELECT
      qb.select([
        'client.id',
        'client.public_id',
        'client.client_name',
        'client.company_name',
        'client.email_1',
        'client.email_2',
        'client.mobile_no_1',
        'client.mobile_no_2',
        'client.contact_person',
        'client.contact_type',
        'client.active',
        'client.created_at',
        'client.updated_at',
      ]);

      // PAGINATION
      if (limit !== -1) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [clients, total] = await qb.getManyAndCount();

      if (!clients || clients.length === 0) {
        return successResponse([], 'No Clients Found', 200);
      }

      return successResponse(
        {
          data: clients,
          pagination: {
            total,
            page,
            limit,
            totalPages: limit === -1 ? 1 : Math.ceil(total / limit),
          },
        },
        'Clients fetched successfully',
        200,
      );
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  // FIND ONE
  async findOne(public_id: string, user: any) {
    try {
      const client = await this.clientRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!client) {
        return errorResponse('Client not found', 404);
      }

      return successResponse(client, 'Client fetched successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  // UPDATE
  async update(public_id: string, body: UpdateClientDto, user: any) {
    try {
      const client = await this.clientRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!client) {
        return errorResponse('Client not found', 404);
      }

      // EMAIL CHECK
      if (body.email_1 && body.email_1 !== client.email_1) {
        const existingEmail = await this.clientRepo.findOne({
          where: {
            email_1: body.email_1,
          },
        });

        if (existingEmail) {
          return errorResponse('Email already exists', 409);
        }
      }

      // MOBILE CHECK
      if (body.mobile_no_1 && body.mobile_no_1 !== client.mobile_no_1) {
        const existingMobile = await this.clientRepo.findOne({
          where: {
            mobile_no_1: body.mobile_no_1,
          },
        });

        if (existingMobile) {
          return errorResponse('Mobile number already exists', 409);
        }
      }

      Object.assign(client, body);

      client.updated_by = user?.id;

      const updatedClient = await this.clientRepo.save(client);

      return successResponse(updatedClient, 'Client updated successfully', 200);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }

  // DELETE
  async remove(public_id: string, user: any) {
    try {
      const client = await this.clientRepo.findOne({
        where: {
          public_id,
          created_by: user?.id,
        },
      });

      if (!client) {
        return errorResponse('Client not found', 404);
      }

      client.deleted_by = user?.id;

      await this.clientRepo.save(client);

      await this.clientRepo.softDelete(client.id);

      return successResponse(null, 'Client deleted successfully', 204);
    } catch (error) {
      console.error(error);
      return CatchError(error);
    }
  }
}
