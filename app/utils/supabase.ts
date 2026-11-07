import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { useAuthStore } from "@/stores/auth";

const supabase: SupabaseClient<Database> | null = null;

export const getSupabase = (useUserToken = false) => {
  const config = useRuntimeConfig();
  if (supabase && !useUserToken) {
    return supabase;
  }

  const authStore = useAuthStore();
  const token = useUserToken ? authStore.accessToken : undefined;

  return createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseKey,
    token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : undefined,
  );
};

export const getServerSupabase = () => {
  const config = useRuntimeConfig();
  return createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseKey,
  );
};
