import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://umpmiumeztnhztneobdy.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcG1pdW1lenRuaHp0bmVvYmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg2MTM3MCwiZXhwIjoyMDc5NDM3MzcwfQ.DRARaDCKQXoDiNgAegPdHM1rXp6qowe6HggYVGSKjBQ";
export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey);
