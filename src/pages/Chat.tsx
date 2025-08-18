import { useState, useEffect, useRef } from 'react';
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

interface CasualUser {
  id: string;
  username: string;
  avatar_color: string;
  status: string;
}

interface DirectMessage {
  id: string;
  content: string;
  sender_username: string;
  created_at: string;
  message_type?: string;
  media_url?: string;
  sender_id: string;
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
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [userPresenceChannel, setUserPresenceChannel] = useState<any>(null);
  const [messageChannels, setMessageChannels] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  // Main user lifecycle management
  useEffect(() => {
    if (currentUser) {
      setUserOnline();
      subscribeToUserPresence();
      subscribeToMatchingEvents();
      startMatching();
      addActivityListeners();
      
      return () => {
        setUserOffline();
        cleanupAllChannels();
        removeActivityListeners();
      };
    }
  }, [currentUser]);

  // Direct message subscriptions
  useEffect(() => {
    cleanupMessageChannels();
    
    if (currentUser && currentDirectChat) {
      loadDirectMessages();
      subscribeToDirectMessages();
    }
  }, [currentDirectChat, currentUser]);

  // Auto-scroll messages
  useEffect(() => {
    scrollToBottom();
  }, [directMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    
    const { data, error } = await supabase
      .from('casual_users')
      .insert({
        username: username.trim(),
        avatar_color: avatarColor,
        status: 'available'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive"
      });
      setIsJoining(false);
      return;
    }

    setCurrentUser(data);
    setIsJoining(false);
  };

  // User presence management
  const setUserOnline = async () => {
    if (!currentUser) return;
    
    await supabase
      .from('casual_users')
      .update({ 
        status: 'available',
        last_active: new Date().toISOString()
      })
      .eq('id', currentUser.id);
  };

  const setUserOffline = async () => {
    if (!currentUser) return;
    
    // If in a chat, update partner status back to available
    if (currentChatPartner && currentDirectChat) {
      await supabase
        .from('casual_users')
        .update({ status: 'available' })
        .eq('id', currentChatPartner.id);
    }
    
    // Immediately set user offline
    const { error } = await supabase
      .from('casual_users')
      .update({ status: 'offline' })
      .eq('id', currentUser.id);
    
    if (error) console.error('Error setting user offline:', error);
  };

  const setUserMatched = async () => {
    if (!currentUser) return;
    
    await supabase
      .from('casual_users')
      .update({ status: 'matched' })
      .eq('id', currentUser.id);
  };

  // Realtime user presence subscription
  const subscribeToUserPresence = () => {
    if (!currentUser || userPresenceChannel) return;

    const channel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'casual_users'
        },
        (payload) => {
          handleUserStatusChange(payload.new as CasualUser);
        }
      )
      .subscribe();

    setUserPresenceChannel(channel);
  };

  // Subscribe to new user insertions for instant matching
  const subscribeToMatchingEvents = () => {
    if (!currentUser) return;

    const channel = supabase
      .channel('matching-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'casual_users'
        },
        (payload) => {
          const newUser = payload.new as CasualUser;
          // If a new user joins and we need a match, try to connect
          if (newUser.status === 'available' && 
              !currentDirectChat && 
              !isSearchingForMatch &&
              newUser.id !== currentUser?.id) {
            setTimeout(() => tryMatch(), 100); // Small delay to avoid race conditions
          }
        }
      )
      .subscribe();

    setMessageChannels(prev => [...prev, channel]);
  };

  const handleUserStatusChange = (user: CasualUser) => {
    // If our current partner went offline, handle disconnection
    if (currentChatPartner && user.id === currentChatPartner.id && user.status === 'offline') {
      handlePartnerDisconnect();
    }
    
    // If a user becomes available and we need a match, try to connect immediately
    if (user.status === 'available' && 
        !currentDirectChat && 
        !isSearchingForMatch &&
        user.id !== currentUser?.id) {
      setTimeout(() => tryMatch(), 100); // Small delay to avoid race conditions
    }
  };

  const handlePartnerDisconnect = async () => {
    if (!currentChatPartner) return;
    
    console.log('Partner disconnected, finding new match...');
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    
    // Update status back to available
    await setUserOnline();
    
    toast({
      title: "Partner disconnected",
      description: "Finding you a new person to chat with...",
    });
    
    // Start matching immediately - no delay
    startMatching();
  };

  // Matching system - no timeouts, immediate real-time matching
  const startMatching = () => {
    if (!currentUser || currentDirectChat) return;
    tryMatch(); // Immediate matching
  };

  const tryMatch = async () => {
    if (!currentUser || currentDirectChat || isSearchingForMatch) return;
    
    setIsSearchingForMatch(true);
    
    try {
      // Use the atomic matching function
      const { data: availableUsers, error } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status', 'available')
        .neq('id', currentUser.id);
      
      if (error) {
        console.error('Error finding users:', error);
        setIsSearchingForMatch(false);
        return;
      }
      
      if (!availableUsers || availableUsers.length === 0) {
        setIsSearchingForMatch(false);
        return;
      }
      
      // Random matching - pick a random available user
      const randomIndex = Math.floor(Math.random() * availableUsers.length);
      const matchUser = availableUsers[randomIndex];
      
      // Set both users to matched status simultaneously
      const [userUpdate, matchUpdate] = await Promise.allSettled([
        setUserMatched(),
        supabase
          .from('casual_users')
          .update({ status: 'matched' })
          .eq('id', matchUser.id)
      ]);

      // Check if both updates succeeded
      if (userUpdate.status === 'rejected' || matchUpdate.status === 'rejected') {
        console.error('Failed to update user statuses');
        setIsSearchingForMatch(false);
        return;
      }
      
      // Create direct chat
      const { data: chatData, error: chatError } = await supabase
        .from('direct_chats')
        .insert({
          user1_id: currentUser.id,
          user2_id: matchUser.id,
          user1_username: currentUser.username,
          user2_username: matchUser.username
        })
        .select()
        .single();

      if (chatError) {
        console.error('Error creating chat:', chatError);
        setIsSearchingForMatch(false);
        return;
      }

      setCurrentChatPartner(matchUser);
      setCurrentDirectChat(chatData);
      setDirectMessages([]);
      setIsSearchingForMatch(false);
      
      toast({
        title: "Connected!",
        description: `You're now chatting with ${matchUser.username}`,
      });
      
    } catch (error) {
      console.error('Error in matching:', error);
      setIsSearchingForMatch(false);
    }
  };

  const skipToNextUser = async () => {
    if (!currentChatPartner) return;
    
    // Set partner back to available
    await supabase
      .from('casual_users')
      .update({ status: 'available' })
      .eq('id', currentChatPartner.id);
    
    await setUserOnline();
    
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    
    toast({
      title: "Finding new person",
      description: "Looking for someone new to chat with...",
    });
    
    tryMatch(); // Immediate matching
  };

  const loadDirectMessages = async () => {
    if (!currentDirectChat) return;
    
    // Load existing messages from this chat
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', currentDirectChat.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error loading direct messages:', error);
      return;
    }

    setDirectMessages(data || []);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !currentDirectChat) return;

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        chat_id: currentDirectChat.id,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        content: newMessage.trim()
      });

    if (error) {
      console.error('Error sending direct message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Update last_message_at
    await supabase
      .from('direct_chats')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', currentDirectChat.id);

    setNewMessage('');
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser || !currentDirectChat) return;

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        chat_id: currentDirectChat.id,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        content: '',
        message_type: mediaType,
        media_url: mediaUrl
      });

    if (error) {
      console.error('Error sending media message:', error);
      return;
    }

    await supabase
      .from('direct_chats')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', currentDirectChat.id);
  };

  const subscribeToDirectMessages = () => {
    if (!currentDirectChat) return;

    const channel = supabase
      .channel(`direct-chat-${currentDirectChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_id=eq.${currentDirectChat.id}`
        },
        (payload) => {
          setDirectMessages(prev => [...prev, payload.new as DirectMessage]);
        }
      )
      .subscribe();

    setMessageChannels(prev => [...prev, channel]);
  };

  // Activity listeners for auto-logout and instant disconnect detection
  const addActivityListeners = () => {
    const handleActivity = () => {
      if (currentUser) {
        supabase
          .from('casual_users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', currentUser.id);
      }
    };

    // Immediate logout on browser close/tab close
    const handleBeforeUnload = () => {
      if (currentUser) {
        setUserOffline();
      }
    };

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tabs or minimized - go offline after short delay
        setTimeout(() => {
          if (document.hidden && currentUser) {
            setUserOffline();
          }
        }, 2000);
      } else if (currentUser) {
        setUserOnline();
      }
    };

    // Add listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousedown', handleActivity);
    document.addEventListener('keypress', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    // Store cleanup function
    (window as any)._chatActivityCleanup = () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousedown', handleActivity);
      document.removeEventListener('keypress', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
    };
  };

  const removeActivityListeners = () => {
    if ((window as any)._chatActivityCleanup) {
      (window as any)._chatActivityCleanup();
    }
  };

  // Cleanup functions
  const cleanupAllChannels = () => {
    if (userPresenceChannel) {
      supabase.removeChannel(userPresenceChannel);
      setUserPresenceChannel(null);
    }
    cleanupMessageChannels();
  };

  const cleanupMessageChannels = () => {
    messageChannels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    setMessageChannels([]);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <Card className="p-4 sm:p-8 max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="mb-6">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                    Talk with
                  </span>
                  <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
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
              </div>
              <p className="text-muted-foreground text-base">
                Meet and chat with random strangers from around the world instantly!
              </p>
            </div>
            
            <div className="space-y-4">
              <Input
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createUser()}
                className="text-center"
              />
              <Button 
                onClick={createUser} 
                disabled={isJoining}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                {isJoining ? 'Joining...' : 'Start Chatting'}
              </Button>
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <div className="grid grid-cols-1 gap-2">
                <div>💬 Anonymous random chat</div>
                <div>🌍 Meet strangers worldwide</div>
                <div>⚡ Instant connections</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Talk with
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
                Stranger
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold"
                style={{ backgroundColor: currentUser.avatar_color }}
              >
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-sm sm:text-base">{currentUser.username}</span>
            </div>
            <ThemeToggle />
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Chat Status */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Random Chat</h3>
                <div className="space-y-3">
                  {isSearchingForMatch && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                      <p className="text-sm text-muted-foreground">Finding someone to chat with...</p>
                    </div>
                  )}
                  
                  {currentDirectChat && currentChatPartner && (
                    <div className="space-y-2">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Chatting with:</p>
                        <p className="text-lg font-semibold text-primary">{currentChatPartner.username}</p>
                      </div>
                      <Button 
                        onClick={skipToNextUser}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        <SkipForward className="w-4 h-4" />
                        Next Person
                      </Button>
                    </div>
                  )}
                  
                  {!currentDirectChat && !isSearchingForMatch && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Looking for someone to chat with...
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            {currentDirectChat ? (
              <Card className="h-[500px] sm:h-[600px] flex flex-col">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-xl">
                        Chatting with: {currentChatPartner?.username}
                      </h2>
                      <p className="text-sm text-muted-foreground">Random conversation</p>
                    </div>
                    <Button 
                      onClick={skipToNextUser}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <SkipForward className="w-3 h-3" />
                      Next
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {directMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-lg ${
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
                            {new Date(message.created_at).toLocaleTimeString()}
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
                    <MediaUpload onMediaUploaded={sendMediaMessage} />
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} size="icon">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="h-[500px] sm:h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Chat</h3>
                  <p className="text-muted-foreground">
                    {isSearchingForMatch 
                      ? "We're finding someone for you to chat with..." 
                      : "Waiting to match you with someone..."
                    }
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;