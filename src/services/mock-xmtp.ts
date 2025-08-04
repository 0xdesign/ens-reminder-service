/**
 * Mock XMTP Service for testing ENS reminder bot without real XMTP credentials
 * This service simulates XMTP messaging functionality for development and testing
 */

export interface MockMessage {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: Date;
  conversation: string;
}

export interface XMTPConversation {
  peerAddress: string;
  messages: MockMessage[];
  createdAt: Date;
}

export class MockXMTPService {
  private conversations: Map<string, XMTPConversation> = new Map();
  private sentMessages: MockMessage[] = [];
  private isConnected: boolean = false;
  private botAddress: string = "0xbot123"; // Mock bot wallet address

  constructor() {
    console.log("[MockXMTP] Initializing mock XMTP service");
  }

  /**
   * Mock connection to XMTP network
   */
  async connect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    this.isConnected = true;
    console.log("[MockXMTP] Connected to mock XMTP network");
  }

  /**
   * Mock disconnection from XMTP network
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log("[MockXMTP] Disconnected from mock XMTP network");
  }

  /**
   * Check if service is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Send a message to a wallet address
   */
  async sendMessage(recipientAddress: string, content: string): Promise<MockMessage> {
    if (!this.isConnected) {
      throw new Error("XMTP service not connected");
    }

    const message: MockMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: this.botAddress,
      recipient: recipientAddress,
      content,
      timestamp: new Date(),
      conversation: this.getConversationId(this.botAddress, recipientAddress)
    };

    // Store the message
    this.sentMessages.push(message);

    // Add to conversation
    const conversationId = this.getConversationId(this.botAddress, recipientAddress);
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        peerAddress: recipientAddress,
        messages: [],
        createdAt: new Date()
      });
    }

    const conversation = this.conversations.get(conversationId)!;
    conversation.messages.push(message);

    console.log(`[MockXMTP] Sent message to ${recipientAddress}: ${content.substring(0, 50)}...`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return message;
  }

  /**
   * Get all conversations for the bot
   */
  async getConversations(): Promise<XMTPConversation[]> {
    if (!this.isConnected) {
      throw new Error("XMTP service not connected");
    }

    return Array.from(this.conversations.values());
  }

  /**
   * Get messages for a specific conversation
   */
  async getMessages(peerAddress: string): Promise<MockMessage[]> {
    if (!this.isConnected) {
      throw new Error("XMTP service not connected");
    }

    const conversationId = this.getConversationId(this.botAddress, peerAddress);
    const conversation = this.conversations.get(conversationId);
    
    return conversation ? conversation.messages : [];
  }

  /**
   * Simulate receiving a message (for testing)
   */
  async simulateIncomingMessage(senderAddress: string, content: string): Promise<MockMessage> {
    const message: MockMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: senderAddress,
      recipient: this.botAddress,
      content,
      timestamp: new Date(),
      conversation: this.getConversationId(senderAddress, this.botAddress)
    };

    // Add to conversation
    const conversationId = this.getConversationId(senderAddress, this.botAddress);
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        peerAddress: senderAddress,
        messages: [],
        createdAt: new Date()
      });
    }

    const conversation = this.conversations.get(conversationId)!;
    conversation.messages.push(message);

    console.log(`[MockXMTP] Received message from ${senderAddress}: ${content.substring(0, 50)}...`);
    
    return message;
  }

  /**
   * Get all sent messages (for testing/verification)
   */
  getSentMessages(): MockMessage[] {
    return [...this.sentMessages];
  }

  /**
   * Clear all messages and conversations (for testing)
   */
  reset(): void {
    this.conversations.clear();
    this.sentMessages = [];
    console.log("[MockXMTP] Reset all messages and conversations");
  }

  /**
   * Get conversation statistics (for testing)
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
    totalSentMessages: number;
  } {
    const totalMessages = Array.from(this.conversations.values())
      .reduce((sum, conv) => sum + conv.messages.length, 0);

    return {
      totalConversations: this.conversations.size,
      totalMessages,
      totalSentMessages: this.sentMessages.length
    };
  }

  /**
   * Generate a consistent conversation ID for two addresses
   */
  private getConversationId(address1: string, address2: string): string {
    const addresses = [address1.toLowerCase(), address2.toLowerCase()].sort();
    return `conv_${addresses[0]}_${addresses[1]}`;
  }

  /**
   * Check if a message was successfully sent to a specific recipient
   */
  wasMessageSentTo(recipientAddress: string, contentSubstring?: string): boolean {
    return this.sentMessages.some(msg => 
      msg.recipient.toLowerCase() === recipientAddress.toLowerCase() &&
      (!contentSubstring || msg.content.includes(contentSubstring))
    );
  }

  /**
   * Get the last message sent to a specific recipient
   */
  getLastMessageTo(recipientAddress: string): MockMessage | null {
    const messages = this.sentMessages
      .filter(msg => msg.recipient.toLowerCase() === recipientAddress.toLowerCase())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return messages.length > 0 ? messages[0] : null;
  }
}

// Singleton instance for the mock service
export const mockXMTPService = new MockXMTPService();