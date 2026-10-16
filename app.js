
const SUPABASE_URL = "https://rnjesgjtjsbaxyafklsu.supabase.co";
const SUPABASE_KEY = "sb_publishable_hVLMaDbWG-iAaQCImWDmJA_ht04LPbY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

console.log("تم تجهيز الاتصال مع Supabase بنجاح");
