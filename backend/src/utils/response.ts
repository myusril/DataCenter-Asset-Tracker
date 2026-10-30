import type { Response } from 'express';

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** Error carrying the HTTP status that the central handler should return. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: ValidationIssue[];

  constructor(statusCode: number, message: string, errors?: ValidationIssue[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): Response {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: ValidationIssue[],
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && errors.length > 0 ? { errors } : {}),
  });
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
