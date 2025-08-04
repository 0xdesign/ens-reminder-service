import { Character } from "@elizaos/core";
import { ensReminderPlugin } from "./plugins/ens-reminder-plugin.js";

// Load character configuration
import characterData from "../character.json";

// Export the character configuration with our custom plugin
export default {
  ...characterData,
  plugins: [
    ...characterData.plugins,
    ensReminderPlugin
  ]
} as Character;