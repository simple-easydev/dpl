// ============================================================================
// CRITICAL: DO NOT MODIFY THIS FILE
// ============================================================================
// This is the CORRECT database connection configuration.
// It uses environment variables from .env which contain the PRODUCTION credentials.
//
// Expected Supabase URL: https://cqztylidsbekbbrkusxg.supabase.co
// Any other URL (especially nhygxwskngmwdbaireih) is INCORRECT and DEPRECATED.
//
// This pattern MUST be maintained:
// - Uses import.meta.env.VITE_SUPABASE_URL (NOT hardcoded URLs)
// - Uses import.meta.env.VITE_SUPABASE_ANON_KEY (NOT hardcoded keys)
// - Includes proper TypeScript typing with Database type
// - Configures auth with autoRefreshToken, persistSession, detectSessionInUrl
//
// DO NOT:
// - Replace with hardcoded credentials
// - Create alternative Supabase client instances
// - Modify the auth configuration
// - Change the environment variable pattern
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Validate that we're using the correct Supabase project
const EXPECTED_SUPABASE_PROJECT = 'cqztylidsbekbbrkusxg';
if (!supabaseUrl.includes(EXPECTED_SUPABASE_PROJECT)) {
  console.error('❌ CRITICAL: Wrong Supabase URL detected!');
  console.error(`Expected project ID: ${EXPECTED_SUPABASE_PROJECT}`);
  console.error(`Current URL: ${supabaseUrl}`);
  console.error('Check your .env file and restore correct credentials from .env.example');
  throw new Error(`Incorrect Supabase URL. Expected project: ${EXPECTED_SUPABASE_PROJECT}`);
}

console.log('✅ Supabase client initialized with correct credentials');
console.log(`Connected to: ${supabaseUrl}`);

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
