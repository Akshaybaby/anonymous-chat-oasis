import { supabase } from '@/integrations/supabase/client';

interface AIResponse {
  message: string;
  delay: number; // milliseconds
}

const aiNames = [
  'Rahul', 'Sneha', 'Arjun', 'Priya', 'Kiran', 'Meera', 'Ravi', 'Anjali',
  'Vikram', 'Divya', 'Arun', 'Kavya', 'Suresh', 'Deepika', 'Akash', 'Nisha'
];

const aiResponses = [
  'Hey there! How are you doing?',
  'Nice to meet you! What brings you here today?',
  'I love chatting with new people!',
  'What do you like to do for fun?',
  'How has your day been so far?',
  'Do you have any hobbies?',
  'I enjoy meeting people from different places',
  'What kind of music do you listen to?',
  'Are you from around here?',
  'I hope you\'re having a great day!',
  'Tell me something interesting about yourself',
  'What\'s your favorite movie?',
  'Do you like traveling?',
  'I find conversations like this really interesting',
  'What makes you happy?',
  'Have you tried this chat before?',
  'I think it\'s cool how we can connect with strangers',
  'What\'s the weather like where you are?',
  'Do you have any pets?',
  'What did you do today?'
];

const followUpResponses = [
  'That sounds really cool!',
  'Oh interesting, tell me more',
  'I can relate to that',
  'That\'s awesome!',
  'Really? That\'s nice',
  'I see, that makes sense',
  'Wow, that\'s great!',
  'That sounds fun!',
  'I\'d love to hear more about that',
  'That\'s really interesting'
];

class AIChatbot {
  private name: string;
  private id: string;
  private avatarColor: string;
  private conversationHistory: string[] = [];

  constructor() {
    this.name = aiNames[Math.floor(Math.random() * aiNames.length)];
    this.id = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.avatarColor = this.getRandomColor();
  }

  private getRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async createAIUser() {
    try {
      const { data, error } = await supabase
        .from('casual_users')
        .insert({
          id: this.id,
          username: this.name,
          avatar_color: this.avatarColor,
          status: 'available',
          last_active: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating AI user:', error);
      return null;
    }
  }

  async removeAIUser() {
    try {
      await supabase
        .from('casual_users')
        .delete()
        .eq('id', this.id);
    } catch (error) {
      console.error('Error removing AI user:', error);
    }
  }

  generateResponse(userMessage: string): AIResponse {
    let message: string;
    let delay: number;

    if (this.conversationHistory.length === 0) {
      // First message - greeting
      message = aiResponses[Math.floor(Math.random() * 5)]; // First 5 are greetings
      delay = 1000 + Math.random() * 2000; // 1-3 seconds
    } else if (userMessage.length > 50 || userMessage.includes('?')) {
      // Long message or question - thoughtful response
      message = followUpResponses[Math.floor(Math.random() * followUpResponses.length)];
      delay = 2000 + Math.random() * 3000; // 2-5 seconds
    } else {
      // Regular response
      message = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      delay = 1500 + Math.random() * 2500; // 1.5-4 seconds
    }

    this.conversationHistory.push(userMessage);
    return { message, delay };
  }

  getUserData() {
    return {
      id: this.id,
      username: this.name,
      avatar_color: this.avatarColor,
      status: 'available'
    };
  }
}

export class AIChatbotManager {
  private activeBots: Map<string, AIChatbot> = new Map();

  async createAIBot(): Promise<AIChatbot | null> {
    const bot = new AIChatbot();
    const aiUser = await bot.createAIUser();
    
    if (aiUser) {
      this.activeBots.set(bot.getUserData().id, bot);
      return bot;
    }
    return null;
  }

  async removeAIBot(botId: string) {
    const bot = this.activeBots.get(botId);
    if (bot) {
      await bot.removeAIUser();
      this.activeBots.delete(botId);
    }
  }

  async removeAllAIBots() {
    for (const [botId, bot] of this.activeBots) {
      await bot.removeAIUser();
    }
    this.activeBots.clear();
  }

  getBot(botId: string): AIChatbot | undefined {
    return this.activeBots.get(botId);
  }

  getBotCount(): number {
    return this.activeBots.size;
  }
}

export default AIChatbot;