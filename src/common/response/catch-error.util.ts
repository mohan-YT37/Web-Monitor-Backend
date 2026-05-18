import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { QueryFailedError } from 'typeorm';

import { errorResponse } from './response.util';

export const CatchError = (error: any) => {
  console.log('ERROR =>', error);

  // ALREADY HANDLED
  if (error instanceof HttpException) {
    throw error;
  }

  // TYPEORM DUPLICATE
  if (error instanceof QueryFailedError) {
    const driverError: any = error.driverError;

    // MYSQL DUPLICATE
    if (driverError?.code === 'ER_DUP_ENTRY') {
      return errorResponse('Resource already exists', 409);
    }

    // POSTGRES DUPLICATE
    if (driverError?.code === '23505') {
      return errorResponse('Resource already exists', 409);
    }
  }

  // JWT
  if (error.name === 'TokenExpiredError') {
    return errorResponse('Token Expired', 401);
  }

  if (error.name === 'JsonWebTokenError') {
    return errorResponse('Invalid Token', 401);
  }

  // AXIOS
  if (error.code === 'ECONNREFUSED') {
    return errorResponse('Service unavailable', 503);
  }

  if (error.code === 'ECONNABORTED') {
    return errorResponse('Request timeout', 408);
  }

  // DEFAULT
  return errorResponse(error?.message || 'Internal Server Error', 500);
};
