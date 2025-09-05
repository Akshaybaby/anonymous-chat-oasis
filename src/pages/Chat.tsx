import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, MessageCircle, Home, SkipForward } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { MediaUpload } from '@/components/MediaUpload';
import { MessageRenderer } from '@/components/MessageRenderer';
import { useSessionHandler } from '@/hooks/useSessionHandler';
import { AIChatbotManager } from '@/services/aiChatbot';

interface CasualUser {
  id: string;
  username: string;
  avatar_color: string;
  status: string;
  last_active?: string;
}

interface DirectMessage {
  id: string;
  content: string;
  sender_username: string;
  created_at: string;
  message_type?: string;
  media_url?: string;
  sender_id: string;
  chat_id?: string;
}

interface DirectChat {
  id: string;
  user1_username: string;
  user2_username: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
}

const Chat = () => {
  const [currentUser, setCurrentUser] = useState<CasualUser | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [currentDirectChat, setCurrentDirectChat] = useState<DirectChat | null>(null);
  const [currentChatPartner, setCurrentChatPartner] = useState<CasualUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('Female');
  const [isJoining, setIsJoining] = useState(false);
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [isPartnerAI, setIsPartnerAI] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageChannelRef = useRef<any>(null);
  const matchingChannelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const matchingRef = useRef<NodeJS.Timeout | null>(null);
  const aiManagerRef = useRef<AIChatbotManager>(new AIChatbotManager());
  
  const { toast } = useToast();

  // Session handler
  const { handleLogout } = useSessionHandler(currentUser, () => {
    setCurrentUser(null);
    setCurrentDirectChat(null);
    setCurrentChatPartner(null);
    setDirectMessages([]);
    setIsSearchingForMatch(false);
    setIsPartnerAI(false);
  });

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Load messages for current chat
  const loadMessages = useCallback(async () => {
    if (!currentDirectChat) return;
    
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('chat_id', currentDirectChat.id)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Error loading messages:', error);
        return;
      }
      
      setDirectMessages(data || []);
      scrollToBottom();
    } catch (err) {
      console.error('Error in loadMessages:', err);
    }
  }, [currentDirectChat, scrollToBottom]);

  // Setup real-time message subscription
  const setupMessageSubscription = useCallback(() => {
    if (!currentDirectChat || messageChannelRef.current) return;

    console.log('Setting up message subscription for chat:', currentDirectChat.id);
    
    messageChannelRef.current = supabase
      .channel(`messages-${currentDirectChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_id=eq.${currentDirectChat.id}`
        },
        (payload) => {
          console.log('New message received:', payload.new);
          const newMessage = payload.new as DirectMessage;
          
          setDirectMessages(prev => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          
          scrollToBottom();
        }
      )
      .subscribe((status) => {
        console.log('Message subscription status:', status);
      });
  }, [currentDirectChat, scrollToBottom]);

  // Setup matching subscription (with partner disconnect detection)
  const setupMatchingSubscription = useCallback(() => {
    if (!currentUser || matchingChannelRef.current) return;

    matchingChannelRef.current = supabase
      .channel('matching')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_chats'
        },
        async (payload) => {
          const newChat = payload.new as DirectChat;
          
          if (newChat.user1_id === currentUser.id || newChat.user2_id === currentUser.id) {
            const partnerId = newChat.user1_id === currentUser.id ? newChat.user2_id : newChat.user1_id;
            const partnerUsername = newChat.user1_id === currentUser.id ? newChat.user2_username : newChat.user1_username;
            
            // Get partner details
            const { data: partner } = await supabase
              .from('casual_users')
              .select('*')
              .eq('id', partnerId)
              .single();
              
            if (partner) {
              // Check if partner is AI
              const isAI = partner.id.startsWith('ai_');
              
              setCurrentChatPartner(partner);
              setCurrentDirectChat(newChat);
              setDirectMessages([]);
              setIsSearchingForMatch(false);
              setIsPartnerAI(isAI);
              
              // Save to localStorage
              localStorage.setItem('current_chat', JSON.stringify(newChat));
              localStorage.setItem('chat_partner', JSON.stringify(partner));
              
              toast({
                title: "Connected!",
                description: `You're now chatting with ${partnerUsername}`,
              });
            }
          }
        }
      )
      // Monitor user status changes to detect disconnects
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'casual_users'
        },
        async (payload) => {
          const updatedUser = payload.new as CasualUser;
          
          // If current chat partner went offline and it's not an AI
          if (currentChatPartner && 
              updatedUser.id === currentChatPartner.id && 
              updatedUser.status === 'offline' && 
              !isPartnerAI) {
            
            toast({
              title: "Partner disconnected",
              description: `${currentChatPartner.username} has left the chat. Finding you someone new...`,
            });
            
            // Clean up current chat
            setCurrentChatPartner(null);
            setCurrentDirectChat(null);
            setDirectMessages([]);
            setIsPartnerAI(false);
            
            localStorage.removeItem('current_chat');
            localStorage.removeItem('chat_partner');
            
            // Set current user back to available and start matching
            await supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id);
            
            setTimeout(() => {
              if (findMatch) {
                setIsSearchingForMatch(true);
                findMatch();
                matchingRef.current = setInterval(() => {
                  findMatch();
                }, 3000);
              }
            }, 1000);
          }
        }
      )
      .subscribe();
  }, [currentUser, currentChatPartner, isPartnerAI, toast]);

  // Send message (with AI response handling)
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUser || !currentDirectChat) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: currentDirectChat.id,
          sender_id: currentUser.id,
          sender_username: currentUser.username,
          content: messageContent,
          message_type: 'text'
        });

      if (error) {
        console.error('Error sending message:', error);
        setNewMessage(messageContent); // Restore message on error
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // If chatting with AI, generate AI response
      if (isPartnerAI && currentChatPartner) {
        const aiBot = aiManagerRef.current.getBot(currentChatPartner.id);
        if (aiBot) {
          const response = aiBot.generateResponse(messageContent);
          
          setTimeout(async () => {
            await supabase
              .from('direct_messages')
              .insert({
                chat_id: currentDirectChat.id,
                sender_id: currentChatPartner.id,
                sender_username: currentChatPartner.username,
                content: response.message,
                message_type: 'text'
              });
          }, response.delay);
        }
      }
    } catch (err) {
      console.error('Error in sendMessage:', err);
      setNewMessage(messageContent);
    }
  }, [newMessage, currentUser, currentDirectChat, isPartnerAI, currentChatPartner, toast]);

  // Find and match with users (with AI fallback)
  const findMatch = useCallback(async () => {
    if (!currentUser || currentDirectChat) return;

    try {
      // First, try to find real users
      const { data: availableUsers } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status', 'available')
        .neq('id', currentUser.id)
        .not('id', 'like', 'ai_%') // Exclude AI users
        .gte('last_active', new Date(Date.now() - 60000).toISOString()) // Last 1 minute
        .limit(5);

      if (availableUsers && availableUsers.length > 0) {
        const targetUser = availableUsers[0];
        
        // Update both users to matched
        await Promise.all([
          supabase.from('casual_users').update({ status: 'matched' }).eq('id', currentUser.id),
          supabase.from('casual_users').update({ status: 'matched' }).eq('id', targetUser.id)
        ]);
        
        // Create chat
        const { data: chatData, error: chatError } = await supabase
          .from('direct_chats')
          .insert({
            user1_id: currentUser.id,
            user2_id: targetUser.id,
            user1_username: currentUser.username,
            user2_username: targetUser.username,
            last_message_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!chatError && chatData) {
          setCurrentChatPartner(targetUser);
          setCurrentDirectChat(chatData);
          setDirectMessages([]);
          setIsSearchingForMatch(false);
          setIsPartnerAI(false);
          
          localStorage.setItem('current_chat', JSON.stringify(chatData));
          localStorage.setItem('chat_partner', JSON.stringify(targetUser));
          
          toast({
            title: "Connected!",
            description: `You're now chatting with ${targetUser.username}`,
          });
        }
      } else {
        // No real users available - create AI chatbot
        const aiBot = await aiManagerRef.current.createAIBot();
        if (aiBot) {
          const aiUserData = aiBot.getUserData();
          
          // Update current user to matched
          await supabase.from('casual_users').update({ status: 'matched' }).eq('id', currentUser.id);
          
          // Create chat with AI
          const { data: chatData, error: chatError } = await supabase
            .from('direct_chats')
            .insert({
              user1_id: currentUser.id,
              user2_id: aiUserData.id,
              user1_username: currentUser.username,
              user2_username: aiUserData.username,
              last_message_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!chatError && chatData) {
            setCurrentChatPartner(aiUserData);
            setCurrentDirectChat(chatData);
            setDirectMessages([]);
            setIsSearchingForMatch(false);
            setIsPartnerAI(true);
            
            localStorage.setItem('current_chat', JSON.stringify(chatData));
            localStorage.setItem('chat_partner', JSON.stringify(aiUserData));
            
            toast({
              title: "Connected!",
              description: `You're now chatting with ${aiUserData.username}`,
            });

            // AI sends first message after a delay
            setTimeout(async () => {
              const response = aiBot.generateResponse('');
              await supabase
                .from('direct_messages')
                .insert({
                  chat_id: chatData.id,
                  sender_id: aiUserData.id,
                  sender_username: aiUserData.username,
                  content: response.message,
                  message_type: 'text'
                });
            }, 2000);
          }
        }
      }
    } catch (error) {
      console.error('Error finding match:', error);
    }
  }, [currentUser, currentDirectChat, toast]);

  // Start matching process
  const startMatching = useCallback(() => {
    if (matchingRef.current || currentDirectChat) return;
    
    setIsSearchingForMatch(true);
    findMatch(); // Try immediately
    
    matchingRef.current = setInterval(() => {
      findMatch();
    }, 3000);
  }, [findMatch, currentDirectChat]);

  // Stop matching
  const stopMatching = useCallback(() => {
    setIsSearchingForMatch(false);
    if (matchingRef.current) {
      clearInterval(matchingRef.current);
      matchingRef.current = null;
    }
  }, []);

  // Heartbeat to maintain presence
  const startHeartbeat = useCallback(() => {
    if (!currentUser || heartbeatRef.current) return;
    
    heartbeatRef.current = setInterval(async () => {
      await supabase
        .from('casual_users')
        .update({ 
          last_active: new Date().toISOString(),
          status: currentDirectChat ? 'matched' : 'available'
        })
        .eq('id', currentUser.id);
    }, 15000);
  }, [currentUser, currentDirectChat]);

  // Create user
  const createUser = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to start chatting",
        variant: "destructive"
      });
      return;
    }

    setIsJoining(true);
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    
    try {
      const { data, error } = await supabase
        .from('casual_users')
        .insert({
          username: username.trim(),
          avatar_color: avatarColor,
          status: 'available',
          last_active: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentUser(data);
      localStorage.setItem('casual_user', JSON.stringify(data));
      
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Skip to next user (with AI cleanup and auto-rematch)
  const skipToNextUser = async () => {
    if (!currentChatPartner || !currentUser) return;
    
    const partnerName = currentChatPartner.username;
    const wasPartnerAI = isPartnerAI;
    
    try {
      if (wasPartnerAI) {
        // Remove AI bot
        await aiManagerRef.current.removeAIBot(currentChatPartner.id);
      } else {
        // Set partner back to available (real user)
        await supabase.from('casual_users').update({ status: 'available' }).eq('id', currentChatPartner.id);
      }
      
      // Set current user back to available
      await supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id);
      
      setCurrentChatPartner(null);
      setCurrentDirectChat(null);
      setDirectMessages([]);
      setIsPartnerAI(false);
      
      localStorage.removeItem('current_chat');
      localStorage.removeItem('chat_partner');
      
      toast({
        title: "Finding new person",
        description: `Left chat with ${partnerName}. Looking for someone new...`,
      });
      
      // Immediately start looking for new match
      setTimeout(() => {
        if (findMatch) {
          setIsSearchingForMatch(true);
          findMatch();
          matchingRef.current = setInterval(() => {
            findMatch();
          }, 3000);
        }
      }, 500);
    } catch (error) {
      console.error('Error skipping user:', error);
    }
  };

  // Cleanup channels
  const cleanupChannels = useCallback(() => {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }
    if (matchingChannelRef.current) {
      supabase.removeChannel(matchingChannelRef.current);
      matchingChannelRef.current = null;
    }
  }, []);

  // Main effects
  useEffect(() => {
    // Restore session
    const savedUser = localStorage.getItem('casual_user');
    const savedChat = localStorage.getItem('current_chat');
    const savedPartner = localStorage.getItem('chat_partner');
    
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      
      if (savedChat && savedPartner) {
        setCurrentDirectChat(JSON.parse(savedChat));
        setCurrentChatPartner(JSON.parse(savedPartner));
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      // Set user online
      supabase
        .from('casual_users')
        .update({ 
          status: currentDirectChat ? 'matched' : 'available',
          last_active: new Date().toISOString()
        })
        .eq('id', currentUser.id);
        
      setupMatchingSubscription();
      startHeartbeat();
      
      if (!currentDirectChat) {
        startMatching();
      }
      
      return () => {
        cleanupChannels();
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (matchingRef.current) clearInterval(matchingRef.current);
        
        // Cleanup AI bots when user logs out
        aiManagerRef.current.removeAllAIBots();
      };
    }
  }, [currentUser, currentDirectChat, setupMatchingSubscription, startHeartbeat, startMatching, cleanupChannels]);

  useEffect(() => {
    if (currentDirectChat) {
      loadMessages();
      setupMessageSubscription();
      
      return () => {
        if (messageChannelRef.current) {
          supabase.removeChannel(messageChannelRef.current);
          messageChannelRef.current = null;
        }
      };
    }
  }, [currentDirectChat, loadMessages, setupMessageSubscription]);

  useEffect(() => {
    scrollToBottom();
  }, [directMessages, scrollToBottom]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Talk with
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-2">
                Stranger
              </span>
            </h1>
            <div className="flex items-center justify-center gap-4 mb-4">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              </Link>
              <ThemeToggle />
            </div>
            <p className="text-muted-foreground">
              Connect instantly with someone random for anonymous chat!
            </p>
          </div>
          
          <div className="space-y-4">
            <Input
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createUser()}
              className="text-center"
              maxLength={20}
            />
            <Button 
              onClick={createUser} 
              disabled={isJoining || !username.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              size="lg"
            >
              {isJoining ? 'Joining...' : 'Start Chatting'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Talk with
            </span>
            <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-2">
              Stranger
            </span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: currentUser.avatar_color }}
              >
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{currentUser.username}</span>
            </div>
            <ThemeToggle />
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {currentDirectChat ? (
          <Card className="h-[600px] flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-xl">
                    Chatting with: {currentChatPartner?.username}
                    {isPartnerAI && <span className="text-xs text-muted-foreground ml-2">(AI)</span>}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Anonymous conversation • Real-time chat
                  </p>
                </div>
                <Button 
                  onClick={skipToNextUser}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <SkipForward className="w-4 h-4" />
                  Next
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {directMessages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Start the conversation! Say hello to {currentChatPartner?.username}
                  </p>
                </div>
              )}
              
              {directMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg ${
                      message.sender_id === currentUser.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {message.sender_username}
                      </span>
                      <span className="text-xs opacity-70">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <MessageRenderer 
                      content={message.content}
                      messageType={message.message_type}
                      mediaUrl={message.media_url}
                    />
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <MediaUpload onMediaUploaded={(url, type) => {
                  // Handle media upload if needed
                }} />
                <Input
                  ref={inputRef}
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1"
                  maxLength={1000}
                />
                <Button 
                  onClick={sendMessage} 
                  size="icon"
                  disabled={!newMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Press Enter to send • Be respectful and have fun!
              </p>
            </div>
          </Card>
        ) : (
          <Card className="h-[600px] flex items-center justify-center">
            <div className="text-center">
              {isSearchingForMatch ? (
                <>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
                  <h3 className="text-xl font-semibold mb-3">Finding Someone...</h3>
                  <p className="text-muted-foreground">
                    We're connecting you with someone who's online right now!
                  </p>
                </>
              ) : (
                <>
                  <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Chat</h3>
                  <p className="text-muted-foreground">
                    Waiting to connect you with someone online...
                  </p>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Chat;
