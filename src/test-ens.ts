import { ethers } from "ethers";

// ENS Registrar ABI (for expiry dates)
const ENS_REGISTRAR_ABI = [
  "function nameExpires(uint256 id) external view returns (uint256)"
];

// ENS Registrar Address
const ENS_REGISTRAR_ADDRESS = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

async function testENSLookup() {
  console.log("Testing ENS domain expiry lookup...");
  
  try {
    // Use a public RPC for testing
    const provider = new ethers.JsonRpcProvider("https://eth-mainnet.alchemyapi.io/v2/demo");
    
    // Test domain
    const domain = "vitalik.eth";
    const name = domain.replace('.eth', '');
    
    // Calculate token ID (keccak256 hash of the name)
    const tokenId = ethers.keccak256(ethers.toUtf8Bytes(name));
    console.log(`Token ID for ${domain}: ${tokenId}`);
    
    // Get registrar contract
    const registrar = new ethers.Contract(
      ENS_REGISTRAR_ADDRESS,
      ENS_REGISTRAR_ABI,
      provider
    );

    // Get expiry timestamp
    console.log("Fetching expiry timestamp...");
    const expiryTimestamp = await registrar.nameExpires(tokenId);
    console.log(`Expiry timestamp: ${expiryTimestamp.toString()}`);
    
    if (expiryTimestamp.toString() === "0") {
      console.log("Domain doesn't exist or not registered");
      return;
    }

    const expiryDate = new Date(Number(expiryTimestamp) * 1000);
    console.log(`${domain} expires on: ${expiryDate.toDateString()}`);
    
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Days until expiry: ${daysUntilExpiry}`);
    
  } catch (error) {
    console.error("Error testing ENS lookup:", error);
  }
}

// Run the test
testENSLookup();