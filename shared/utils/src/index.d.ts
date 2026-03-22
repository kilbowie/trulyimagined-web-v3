/**
 * Shared Utility Functions for Truly Imagined v3
 */
import type { ApiResponse } from '@trulyimagined/types';
export declare function generateId(): string;
export declare function successResponse<T>(data: T): ApiResponse<T>;
export declare function errorResponse(error: string): ApiResponse;
export declare function now(): Date;
export declare function formatDate(date: Date): string;
export declare function isValidEmail(email: string): boolean;
export declare function isValidUUID(id: string): boolean;
export declare function sanitizeString(input: string): string;
export declare function truncate(text: string, maxLength: number): string;
//# sourceMappingURL=index.d.ts.map