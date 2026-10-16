
const SUPABASE_URL = "https://rnjesgjtjsbaxyafklsu.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_hVLMaDbWG-iAaQCImWDmJA_ht04LPbY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log("تم تجهيز الاتصال مع Supabase بنجاح");
