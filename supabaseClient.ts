
import { createClient } from '@supabase/supabase-js';

// Your Supabase configuration
// URL and Key must be inside quotes ""
const supabaseUrl = "https://vmmxqmvyrfxlugedlkre.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtbXhxbXZ5cmZ4bHVnZWRsa3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTIxMDQsImV4cCI6MjA3OTQ2ODEwNH0.V7N5-y1FRDilhFws2e3LYJgbisMl0GL6iz0me3pF-Wc";

export const supabase = createClient(supabaseUrl, supabaseKey);
