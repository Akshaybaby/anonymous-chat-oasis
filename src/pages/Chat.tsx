import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, MessageCircle, Home, SkipForward, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { MediaUpload } from '@/components/MediaUpload';
import { MessageRenderer } from '@/components/MessageRenderer';

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

interface PendingMedia {
  url: string;
  type: 'image' | 'video';
}

const Chat = () => {
  const [currentUser, setCurrentUser] = useState<CasualUser | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [currentDirectChat, setCurrentDirectChat] = useState<DirectChat | null>(null);
  const [currentChatPartner, setCurrentChatPartner] = useState<CasualUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageChannelRef = useRef<any>(null);
  const matchingChannelRef = useRef<any>(null);
  const partnerStatusChannelRef = useRef<any>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const matchingRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

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

  // Handle partner disconnect - triggered when partner leaves
  const handlePartnerDisconnect = useCallback(async () => {
    if (!currentUser) return;
    
    const partnerName = currentChatPartner?.username || 'Your partner';
    
    // Clear current chat state
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    setPendingMedia(null);
    
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    
    // Set self back to available
    await supabase
      .from('casual_users')
      .update({ status: 'available' })
      .eq('id', currentUser.id);
    
    toast({
      title: "Partner left",
      description: `${partnerName} has left the chat. Finding someone new...`,
    });
    
    // Start finding new match
    setIsSearchingForMatch(true);
  }, [currentUser, currentChatPartner, toast]);

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

  // Setup partner status subscription - detect when partner leaves
  const setupPartnerStatusSubscription = useCallback(() => {
    if (!currentChatPartner || partnerStatusChannelRef.current) return;

    console.log('Setting up partner status subscription for:', currentChatPartner.id);
    
    partnerStatusChannelRef.current = supabase
      .channel(`partner-status-${currentChatPartner.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'casual_users',
          filter: `id=eq.${currentChatPartner.id}`
        },
        (payload) => {
          const updatedPartner = payload.new as CasualUser;
          console.log('Partner status changed:', updatedPartner.status);
          
          // If partner became available, they left the chat
          if (updatedPartner.status === 'available') {
            handlePartnerDisconnect();
          }
        }
      )
      .subscribe((status) => {
        console.log('Partner status subscription:', status);
      });
  }, [currentChatPartner, handlePartnerDisconnect]);

  // Setup matching subscription
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
            
            const { data: partner } = await supabase
              .from('casual_users')
              .select('*')
              .eq('id', partnerId)
              .single();
              
            if (partner) {
              setCurrentChatPartner(partner);
              setCurrentDirectChat(newChat);
              setDirectMessages([]);
              setIsSearchingForMatch(false);
              
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
      .subscribe();
  }, [currentUser, toast]);

  // Send message (with optional media)
  const sendMessage = useCallback(async () => {
    if ((!newMessage.trim() && !pendingMedia) || !currentUser || !currentDirectChat) return;

    const messageContent = newMessage.trim() || (pendingMedia ? `Shared ${pendingMedia.type}` : '');
    const mediaToSend = pendingMedia;
    
    setNewMessage('');
    setPendingMedia(null);

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: currentDirectChat.id,
          sender_id: currentUser.id,
          sender_username: currentUser.username,
          content: messageContent,
          message_type: mediaToSend ? mediaToSend.type : 'text',
          media_url: mediaToSend?.url || null
        });

      if (error) {
        console.error('Error sending message:', error);
        setNewMessage(messageContent);
        setPendingMedia(mediaToSend);
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error in sendMessage:', err);
      setNewMessage(messageContent);
      setPendingMedia(mediaToSend);
    }
  }, [newMessage, pendingMedia, currentUser, currentDirectChat, toast]);

  // Find and match with users
  const findMatch = useCallback(async () => {
    if (!currentUser || currentDirectChat) return;

    try {
      const { data: availableUsers } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status', 'available')
        .neq('id', currentUser.id)
        .gte('last_active', new Date(Date.now() - 60000).toISOString())
        .limit(5);

      if (availableUsers && availableUsers.length > 0) {
        const targetUser = availableUsers[0];
        
        // Update both users to matched status
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
          
          localStorage.setItem('current_chat', JSON.stringify(chatData));
          localStorage.setItem('chat_partner', JSON.stringify(targetUser));
          
          toast({
            title: "Connected!",
            description: `You're now chatting with ${targetUser.username}`,
          });
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
    findMatch();
    
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

  // Skip to next user - also disconnects partner
  const skipToNextUser = async () => {
    if (!currentUser) return;
    
    const partnerName = currentChatPartner?.username;
    
    try {
      // Set current user back to available (this triggers partner's subscription)
      await supabase
        .from('casual_users')
        .update({ status: 'available' })
        .eq('id', currentUser.id);
      
      // Clear local state
      setCurrentChatPartner(null);
      setCurrentDirectChat(null);
      setDirectMessages([]);
      setPendingMedia(null);
      
      localStorage.removeItem('current_chat');
      localStorage.removeItem('chat_partner');
      
      toast({
        title: "Finding new person",
        description: partnerName ? `Left chat with ${partnerName}. Looking for someone new...` : 'Looking for someone new...',
      });
      
      // Start matching for new partner
      setIsSearchingForMatch(true);
    } catch (error) {
      console.error('Error skipping user:', error);
    }
  };

  // Go home - disconnect and navigate
  const goHome = async () => {
    if (currentUser) {
      // Set user to available to trigger partner disconnect
      await supabase
        .from('casual_users')
        .update({ status: 'available' })
        .eq('id', currentUser.id);
    }
    
    // Clear all state
    localStorage.removeItem('casual_user');
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    
    navigate('/');
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
    if (partnerStatusChannelRef.current) {
      supabase.removeChannel(partnerStatusChannelRef.current);
      partnerStatusChannelRef.current = null;
    }
  }, []);

  // Handle media upload - preview before sending
  const handleMediaUploaded = (url: string, type: 'image' | 'video') => {
    setPendingMedia({ url, type });
  };

  // Remove pending media
  const removePendingMedia = () => {
    setPendingMedia(null);
  };

  // Main effects
  useEffect(() => {
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
      };
    }
  }, [currentUser, currentDirectChat, setupMatchingSubscription, startHeartbeat, startMatching, cleanupChannels]);

  // Setup subscriptions when chat partner changes
  useEffect(() => {
    if (currentDirectChat) {
      loadMessages();
      setupMessageSubscription();
      setupPartnerStatusSubscription();
      stopMatching();
      
      return () => {
        if (messageChannelRef.current) {
          supabase.removeChannel(messageChannelRef.current);
          messageChannelRef.current = null;
        }
        if (partnerStatusChannelRef.current) {
          supabase.removeChannel(partnerStatusChannelRef.current);
          partnerStatusChannelRef.current = null;
        }
      };
    }
  }, [currentDirectChat, loadMessages, setupMessageSubscription, setupPartnerStatusSubscription, stopMatching]);

  // Re-trigger matching when searching
  useEffect(() => {
    if (isSearchingForMatch && !matchingRef.current && !currentDirectChat) {
      findMatch();
      matchingRef.current = setInterval(() => {
        findMatch();
      }, 3000);
    }
    
    return () => {
      if (!isSearchingForMatch && matchingRef.current) {
        clearInterval(matchingRef.current);
        matchingRef.current = null;
      }
    };
  }, [isSearchingForMatch, currentDirectChat, findMatch]);

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
            <Button variant="outline" size="sm" className="gap-2" onClick={goHome}>
              <Home className="w-4 h-4" />
              Home
            </Button>
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
              {/* Pending media preview */}
              {pendingMedia && (
                <div className="mb-3 relative inline-block">
                  <div className="relative rounded-lg overflow-hidden border bg-muted p-2">
                    {pendingMedia.type === 'image' ? (
                      <img 
                        src={pendingMedia.url} 
                        alt="Pending upload" 
                        className="max-h-32 max-w-[200px] rounded object-cover"
                      />
                    ) : (
                      <video 
                        src={pendingMedia.url} 
                        className="max-h-32 max-w-[200px] rounded"
                        controls
                      />
                    )}
                    <button
                      onClick={removePendingMedia}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click send to share this {pendingMedia.type}
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <MediaUpload onMediaUploaded={handleMediaUploaded} />
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
                  disabled={!newMessage.trim() && !pendingMedia}
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
