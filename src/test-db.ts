import { createClient } from "@supabase/supabase-js";

async function testSupabaseConnection() {
  console.log("Testing Supabase connection...");
  
  // Note: These would need to be replaced with actual Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || "https://your-project.supabase.co";
  const supabaseKey = process.env.SUPABASE_ANON_KEY || "your-supabase-anon-key";
  
  if (supabaseUrl.includes("your-project") || supabaseKey.includes("your-")) {
    console.log("⚠️ Supabase credentials not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to environment.");
    console.log("This test requires a real Supabase project to be set up.");
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test inserting a reminder
    const testReminder = {
      domain: "test.eth",
      wallet_address: "0x1234567890123456789012345678901234567890",
      expiry_date: new Date("2025-12-31").toISOString(),
      reminders_sent: JSON.stringify([]),
      created_at: new Date().toISOString()
    };
    
    console.log("Testing database insert...");
    const { data, error } = await supabase
      .from('reminders')
      .insert(testReminder)
      .select();
    
    if (error) {
      console.error("Database error:", error);
      return;
    }
    
    console.log("✅ Successfully inserted test reminder:", data);
    
    // Test retrieving reminders
    console.log("Testing database query...");
    const { data: reminders, error: queryError } = await supabase
      .from('reminders')
      .select('*')
      .eq('wallet_address', testReminder.wallet_address);
    
    if (queryError) {
      console.error("Query error:", queryError);
      return;
    }
    
    console.log("✅ Successfully retrieved reminders:", reminders);
    
    // Clean up test data
    if (data && data[0]) {
      await supabase
        .from('reminders')
        .delete()
        .eq('id', data[0].id);
      console.log("✅ Cleaned up test data");
    }
    
  } catch (error) {
    console.error("Error testing Supabase:", error);
  }
}

// Run the test
testSupabaseConnection();