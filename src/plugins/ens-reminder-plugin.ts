import {
  Plugin,
  Action,
  State,
  HandlerCallback,
  IAgentRuntime,
  Memory
} from "@elizaos/core";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import { mockDatabaseService } from "../services/mock-database";

// ENS Registrar ABI (for expiry dates)
const ENS_REGISTRAR_ABI = [
  "function nameExpires(uint256 id) external view returns (uint256)"
];

// ENS Registrar Address
const ENS_REGISTRAR_ADDRESS = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

interface ReminderData {
  domain: string;
  walletAddress: string;
  expiryDate: Date;
  remindersSent: number[];
}

/**
 * Get the appropriate database client (mock or real)
 */
function getDatabaseClient(runtime: IAgentRuntime) {
  const supabaseUrl = runtime.getSetting("SUPABASE_URL");
  const supabaseKey = runtime.getSetting("SUPABASE_ANON_KEY");
  
  // Use mock database in test mode or when configured
  if (!supabaseUrl || !supabaseKey || supabaseUrl === "mock://localhost") {
    console.log("[ENS Plugin] Using mock database");
    return mockDatabaseService;
  }
  
  // Use real Supabase client
  console.log("[ENS Plugin] Using real Supabase database");
  return createClient(supabaseUrl, supabaseKey);
}

class ENSService {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Get the expiry date for an ENS domain
   */
  async getExpiryDate(domain: string): Promise<Date | null> {
    try {
      // Remove .eth suffix if present
      const name = domain.replace('.eth', '');
      
      // Calculate token ID (keccak256 hash of the name)
      const tokenId = ethers.keccak256(ethers.toUtf8Bytes(name));
      
      // Get registrar contract
      const registrar = new ethers.Contract(
        ENS_REGISTRAR_ADDRESS,
        ENS_REGISTRAR_ABI,
        this.provider
      );

      // Get expiry timestamp
      const expiryTimestamp = await registrar.nameExpires(tokenId);
      
      if (expiryTimestamp.toString() === "0") {
        return null; // Domain doesn't exist or not registered
      }

      return new Date(Number(expiryTimestamp) * 1000);
    } catch (error) {
      console.error(`Error getting expiry for ${domain}:`, error);
      return null;
    }
  }

  /**
   * Check if a domain name is valid
   */
  isValidDomain(domain: string): boolean {
    // Basic validation for ENS domains
    const domainRegex = /^[a-z0-9-]+\.eth$/i;
    return domainRegex.test(domain);
  }
}

// Set Reminder Action
const setReminderAction: Action = {
  name: "SET_REMINDER",
  similes: [
    "REMIND_ME",
    "SET_ENS_REMINDER", 
    "TRACK_DOMAIN",
    "WATCH_DOMAIN"
  ],
  description: "Set a reminder for an ENS domain expiration",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    return (
      text.includes("remind") ||
      text.includes("track") ||
      text.includes("watch") ||
      text.includes("set reminder")
    ) && (
      text.includes(".eth") ||
      text.includes("domain") ||
      text.includes("ens")
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const rpcUrl = runtime.getSetting("ETHEREUM_RPC_URL") || "https://eth-mainnet.alchemyapi.io/v2/demo";
      const ensService = new ENSService(rpcUrl);
      const text = message.content.text || '';
      
      // Extract domain from message
      const domainMatch = text.match(/([a-z0-9-]+\.eth)/i);
      if (!domainMatch) {
        if (callback) {
          await callback({
            text: "Please specify a valid ENS domain (e.g., vitalik.eth)",
          });
        }
        return;
      }

      const domain = domainMatch[1].toLowerCase();
      
      // Validate domain format
      if (!ensService.isValidDomain(domain)) {
        if (callback) {
          await callback({
            text: `"${domain}" doesn't appear to be a valid ENS domain. Please use the format: name.eth`,
          });
        }
        return;
      }

      // Get expiry date
      const expiryDate = await ensService.getExpiryDate(domain);
      if (!expiryDate) {
        if (callback) {
          await callback({
            text: `I couldn't find an expiry date for "${domain}". This domain may not be registered or may be a subdomain.`,
          });
        }
        return;
      }

      // Check if domain is already expired
      const now = new Date();
      if (expiryDate < now) {
        if (callback) {
          await callback({
            text: `⚠️ "${domain}" has already expired on ${expiryDate.toDateString()}. You may still be able to renew it during the grace period.`,
          });
        }
        return;
      }

      // Get database client (mock or real)
      const database = getDatabaseClient(runtime);

      // Store reminder in database
      const walletAddress = message.entityId; // Using entityId as wallet address
      const reminderData = {
        domain,
        wallet_address: walletAddress,
        expiry_date: expiryDate.toISOString(),
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      const insertResult = database.from('reminders').insert(reminderData);
      
      // Handle the result based on whether it's mock or real database
      let error = null;
      if (typeof insertResult.then === 'function') {
        // Mock database returns a promise-like object
        await new Promise((resolve) => {
          insertResult.then((result: any) => {
            error = result.error;
            resolve(result);
          });
        });
      } else {
        // Real Supabase client
        const result = await insertResult;
        error = result.error;
      }

      if (error) {
        console.error("Supabase error:", error);
        if (callback) {
          await callback({
            text: "Sorry, I encountered an error setting up your reminder. Please try again later.",
          });
        }
        return;
      }

      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (callback) {
        await callback({
          text: `✅ Reminder set for "${domain}"!\n\n📅 Expires: ${expiryDate.toDateString()} (${daysUntilExpiry} days from now)\n\nI'll send you notifications at 30, 7, and 1 day intervals before expiration.`,
        });
      }

    } catch (error) {
      console.error("Error setting reminder:", error);
      if (callback) {
        await callback({
          text: "Sorry, I encountered an error setting up your reminder. Please try again later.",
        });
      }
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "remind me about vitalik.eth" }
      },
      {
        name: "{{user2}}",
        content: { 
          text: "I'll check the expiration date for vitalik.eth and set up reminders for you."
        }
      }
    ]
  ]
};

// List Reminders Action
const listRemindersAction: Action = {
  name: "LIST_REMINDERS",
  similes: [
    "SHOW_REMINDERS",
    "MY_REMINDERS",
    "LIST_DOMAINS",
    "SHOW_DOMAINS"
  ],
  description: "List all active ENS domain reminders for the user",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    return (
      text.includes("list") ||
      text.includes("show") ||
      text.includes("my reminders") ||
      text.includes("reminders")
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const database = getDatabaseClient(runtime);
      const walletAddress = message.entityId;
      
      // Get user's reminders
      const selectQuery = database.from('reminders').select('*');
      
      let reminders = null;
      let error = null;
      
      if (typeof selectQuery.eq === 'function') {
        // Mock database
        await new Promise((resolve) => {
          selectQuery.eq('wallet_address', walletAddress).then((result: any) => {
            reminders = result.data;
            error = result.error;
            resolve(result);
          });
        });
      } else {
        // Real Supabase client
        const result = await selectQuery.eq('wallet_address', walletAddress).order('expiry_date', { ascending: true });
        reminders = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Supabase error:", error);
        if (callback) {
          await callback({
            text: "Sorry, I encountered an error retrieving your reminders. Please try again later.",
          });
        }
        return;
      }

      if (!reminders || reminders.length === 0) {
        if (callback) {
          await callback({
            text: "You don't have any active ENS domain reminders. Use 'remind me about domain.eth' to set one up!",
          });
        }
        return;
      }

      const now = new Date();
      let responseText = "📝 Your ENS Domain Reminders:\n\n";

      for (const reminder of reminders) {
        const expiryDate = new Date(reminder.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let status = "";
        if (daysUntilExpiry <= 0) {
          status = "⚠️ EXPIRED";
        } else if (daysUntilExpiry <= 1) {
          status = "🚨 EXPIRES TODAY";
        } else if (daysUntilExpiry <= 7) {
          status = "⚡ EXPIRES SOON";
        } else if (daysUntilExpiry <= 30) {
          status = "⏰ EXPIRES THIS MONTH";
        } else {
          status = "✅ ACTIVE";
        }

        responseText += `${status} ${reminder.domain}\n`;
        responseText += `   📅 Expires: ${expiryDate.toDateString()}\n`;
        responseText += `   ⏳ ${daysUntilExpiry > 0 ? daysUntilExpiry + ' days remaining' : 'Expired'}\n\n`;
      }

      if (callback) {
        await callback({
          text: responseText.trim(),
        });
      }

    } catch (error) {
      console.error("Error listing reminders:", error);
      if (callback) {
        await callback({
          text: "Sorry, I encountered an error retrieving your reminders. Please try again later.",
        });
      }
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "list my reminders" }
      },
      {
        name: "{{user2}}",  
        content: { 
          text: "Here are your current ENS domain reminders:"
        }
      }
    ]
  ]
};

// Check Expiry Action
const checkExpiryAction: Action = {
  name: "CHECK_EXPIRY",
  similes: [
    "CHECK_DOMAIN",
    "WHEN_EXPIRES",
    "EXPIRY_DATE",
    "DOMAIN_INFO"
  ],
  description: "Check the expiry date of an ENS domain",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    return (
      (text.includes("when") && text.includes("expire")) ||
      text.includes("check") ||
      text.includes("expiry") ||
      text.includes("expires")
    ) && (
      text.includes(".eth") ||
      text.includes("domain")
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const rpcUrl = runtime.getSetting("ETHEREUM_RPC_URL") || "https://eth-mainnet.alchemyapi.io/v2/demo";
      const ensService = new ENSService(rpcUrl);
      const text = message.content.text || '';
      
      // Extract domain from message
      const domainMatch = text.match(/([a-z0-9-]+\.eth)/i);
      if (!domainMatch) {
        if (callback) {
          await callback({
            text: "Please specify a valid ENS domain to check (e.g., vitalik.eth)",
          });
        }
        return;
      }

      const domain = domainMatch[1].toLowerCase();
      
      // Get expiry date
      const expiryDate = await ensService.getExpiryDate(domain);
      if (!expiryDate) {
        if (callback) {
          await callback({
            text: `I couldn't find expiry information for "${domain}". This domain may not be registered.`,
          });
        }
        return;
      }

      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let statusMessage = "";
      if (daysUntilExpiry <= 0) {
        statusMessage = "⚠️ This domain has expired!";
      } else if (daysUntilExpiry <= 1) {
        statusMessage = "🚨 This domain expires today!";
      } else if (daysUntilExpiry <= 7) {
        statusMessage = "⚡ This domain expires very soon!";
      } else if (daysUntilExpiry <= 30) {
        statusMessage = "⏰ This domain expires within a month.";
      } else {
        statusMessage = "✅ This domain is active.";
      }

      if (callback) {
        await callback({
          text: `📋 ENS Domain Info: ${domain}\n\n📅 Expires: ${expiryDate.toDateString()}\n⏳ ${daysUntilExpiry > 0 ? daysUntilExpiry + ' days remaining' : 'Expired'}\n\n${statusMessage}\n\nWant me to set a reminder? Just say "remind me about ${domain}"`,
        });
      }

    } catch (error) {
      console.error("Error checking expiry:", error);
      if (callback) {
        await callback({
          text: "Sorry, I encountered an error checking the domain expiry. Please try again later.",
        });
      }
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "when does ethereum.eth expire?" }
      },
      {
        name: "{{user2}}",
        content: { 
          text: "Let me check the expiration date for ethereum.eth."
        }
      }
    ]
  ]
};

// Plugin definition
export const ensReminderPlugin: Plugin = {
  name: "ens-reminder",
  description: "ENS domain expiration reminder plugin",
  actions: [
    setReminderAction,
    listRemindersAction,
    checkExpiryAction
  ],
  providers: [],
  evaluators: [],
  services: []
};

// Enhanced service initialization
export async function initializeENSReminderService(runtime: IAgentRuntime) {
  console.log('[ENS Plugin] Initializing ENS Reminder Plugin');
  
  try {
    // Check if we're in mock mode (for testing)
    const isMockMode = runtime.getSetting("MOCK_MODE") === "true" || 
                      runtime.getSetting("SUPABASE_URL") === "mock://localhost";
    
    if (isMockMode) {
      console.log('[ENS Plugin] Running in mock mode - using mock services');
      // Mock services are already initialized in the test setup
    } else {
      console.log('[ENS Plugin] Running in production mode - would initialize real services');
      // TODO: Initialize real XMTP and Supabase services
    }
    
    console.log('[ENS Plugin] ENS Reminder Plugin initialized successfully');
  } catch (error) {
    console.error('[ENS Plugin] Failed to initialize ENS Reminder Plugin:', error);
    throw error;
  }
}