
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL অথবা Key পাওয়া যায়নি। .env ফাইল পরীক্ষা করুন।"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);