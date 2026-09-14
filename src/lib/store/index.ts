import { isDemo } from '../config';
import { demoStore } from './demoStore';
import { supabaseStore } from './supabaseStore';
import type { Store } from './types';

export const store: Store = isDemo ? demoStore : supabaseStore;
export type { Query, Store } from './types';
