export type Scalar = string | number | boolean | null;

export interface Query {
  select?: string;
  eq?: Record<string, Scalar>;
  neq?: Record<string, Scalar>;
  gte?: Record<string, string | number>;
  lte?: Record<string, string | number>;
  in?: Record<string, (string | number)[]>;
  order?: string;          // "sort.asc,created_at.desc"
  limit?: number;
}

export interface AuthUser { id: string; email?: string }

export interface Store {
  readonly demo: boolean;
  list<T = any>(table: string, q?: Query): Promise<T[]>;
  get<T = any>(table: string, id: string | number, idCol?: string): Promise<T | null>;
  insert<T = any>(table: string, row: object): Promise<T>;
  update<T = any>(table: string, id: string | number, patch: object, idCol?: string): Promise<T>;
  upsert<T = any>(table: string, row: object, conflict: string): Promise<T>;
  remove(table: string, id: string | number, idCol?: string): Promise<void>;
  rpc<T = any>(fn: string, args?: object): Promise<T>;

  publicUrl(path: string | null | undefined): string;
  upload(path: string, file: Blob): Promise<string>;
  deleteFiles(paths: string[]): Promise<void>;

  auth: {
    user(): AuthUser | null;
    signIn(email: string, password: string): Promise<AuthUser>;
    signOut(): Promise<void>;
    isAdmin(): Promise<boolean>;
    updatePassword(password: string): Promise<void>;
    sendReset(email: string, redirectTo: string): Promise<void>;
    takeRecoveryFromUrl(): boolean;
  };
}
