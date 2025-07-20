export interface Memory {
  readonly id: string;
  readonly content: string;
  readonly embedding?: readonly number[];
  readonly metadata?: Record<string, unknown>;
  readonly tags?: readonly string[];
  readonly type?: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly confidence?: number;
}

export interface CreateMemoryRequest {
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: readonly string[];
  readonly type?: string;
}

export interface UpdateMemoryRequest {
  readonly content?: string;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: readonly string[];
  readonly type?: string;
}

export interface SearchMemoryParams {
  readonly query?: string;
  readonly type?: string;
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
  readonly threshold?: number;
  readonly created_after?: string;
  readonly created_before?: string;
}

export interface ListMemoryParams {
  readonly type?: string;
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
  readonly created_after?: string;
  readonly created_before?: string;
}

export interface BatchMemoryRequest {
  readonly operation: 'create' | 'update' | 'delete';
  readonly memories: readonly (
    | CreateMemoryRequest
    | (UpdateMemoryRequest & { readonly id: string })
    | { readonly id: string }
  )[];
}

export interface HealthStatus {
  readonly status: 'healthy' | 'unhealthy';
  readonly version: string;
  readonly timestamp: string;
  readonly uptime: number;
  readonly checks?: Record<string, 'healthy' | 'unhealthy'>;
}

export interface ErrorResponse {
  readonly error: string;
  readonly message?: string;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
}

export interface MemoryStream {
  readonly memories: AsyncIterable<Memory>;
  destroy(): void;
}

export interface AppConfig {
  readonly server: {
    readonly port: number;
    readonly host: string;
    readonly version: string;
  };
  readonly database: {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
    readonly password: string;
    readonly ssl: boolean;
    readonly pool: {
      readonly min: number;
      readonly max: number;
    };
  };
  readonly api: {
    readonly maxRequestSize: string;
    readonly compression: boolean;
    readonly cors: boolean;
    readonly rateLimit: number | false;
  };
  readonly security: {
    readonly apiKey?: string;
    readonly jwt?: {
      readonly secret: string;
      readonly expiresIn: string;
    };
  };
  readonly monitoring: {
    readonly metrics: boolean;
  };
}
