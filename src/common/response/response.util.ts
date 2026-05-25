import { HttpException, HttpStatus } from '@nestjs/common';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  status: boolean;
  message: string;
  statusCode: number;
  data: T;
}

export const successResponse = <T>(
  data: T,
  message = 'Success',
  statusCode = HttpStatus.OK,
): ApiResponse<T> => ({
  status: true,
  message,
  statusCode,
  data,
});

export const paginatedResponse = <T>(
  data: T[],
  pagination: PaginationMeta,
  message = 'Success',
  statusCode = HttpStatus.OK,
): ApiResponse<any> => ({
  status: true,
  message,
  statusCode,
  data: {
    data,
    pagination,
  },
});

export const errorResponse = (
  message = 'Something went wrong',
  statusCode = HttpStatus.BAD_REQUEST,
  errors: any = [],
): never => {
  throw new HttpException(
    {
      status: false,
      message,
      statusCode,
      data: errors,
    },
    statusCode,
  );
};

export const permissionDenied = (action: string, module: string) => {
  throw new HttpException(
    {
      status: false,
      message: `You are not allowed to ${action} ${module}`,
      data: [],
      statusCode: HttpStatus.FORBIDDEN,
    },
    HttpStatus.FORBIDDEN,
  );
};
