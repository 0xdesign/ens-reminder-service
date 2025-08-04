import { AgentRuntime, Character, IAgentRuntime } from "@elizaos/core";
import { ensReminderPlugin } from "./plugins/ens-reminder-plugin.js";
import characterData from "../character.json";

// Create the character with our plugin
const character: Character = {
  ...characterData,
  plugins: [
    ...characterData.plugins,
    "ens-reminder"
  ]
} as Character;

async function startAgent() {
  console.log("Starting ENS Reminder Bot...");
  
  try {
    // Create runtime with basic configuration
    const runtime = new AgentRuntime({
      agentId: "ens-reminder-bot",
      character,
      token: "TEST",
      settings: {
        ETHEREUM_RPC_URL: "https://eth-mainnet.alchemyapi.io/v2/demo",
        SUPABASE_URL: process.env.SUPABASE_URL || "",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
      }
    });

    // Register our plugin
    runtime.registerPlugin(ensReminderPlugin);
    
    console.log("✅ ENS Reminder Bot started successfully!");
    console.log("Available actions:");
    console.log("- SET_REMINDER: 'remind me about domain.eth'");
    console.log("- LIST_REMINDERS: 'list my reminders'");
    console.log("- CHECK_EXPIRY: 'when does domain.eth expire?'");
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log("\n👋 Shutting down ENS Reminder Bot...");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("Error starting ENS Reminder Bot:", error);
    process.exit(1);
  }
}

// Start the agent if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startAgent();
}

export { character, ensReminderPlugin };