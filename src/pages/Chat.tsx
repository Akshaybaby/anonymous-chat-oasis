import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Users, MessageCircle, Home, SkipForward, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { MediaUpload } from '@/components/MediaUpload';
import { MessageRenderer } from '@/components/MessageRenderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CasualUser {
  id: string;
  username: string;
  avatar_color: string;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
}

interface Message {
  id: string;
  content: string;
  username: string;
  created_at: string;
  message_type?: string;
  media_url?: string;
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

interface RoomParticipant {
  id: string;
  username: string;
  user_id: string;
}

const Chat = () => {
  const [currentUser, setCurrentUser] = useState<CasualUser | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [currentDirectChat, setCurrentDirectChat] = useState<DirectChat | null>(null);
  const [currentChatPartner, setCurrentChatPartner] = useState<string>('');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<RoomParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [activeTab, setActiveTab] = useState('direct');
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [randomMatch, setRandomMatch] = useState<CasualUser | null>(null);
  const [reconnectTimeout, setReconnectTimeout] = useState<NodeJS.Timeout | null>(null);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);
  const [userStatusChannel, setUserStatusChannel] = useState<any>(null);
  const [idleTimeout, setIdleTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  useEffect(() => {
    loadRooms();
  }, []);

  // Activity tracking for idle detection
  const resetIdleTimer = () => {
    setLastActivity(new Date());
    if (idleTimeout) {
      clearTimeout(idleTimeout);
    }
    
    const timeout = setTimeout(() => {
      console.log('User idle for 4 minutes, setting offline');
      setUserStatusOffline();
    }, 4 * 60 * 1000); // 4 minutes
    
    setIdleTimeout(timeout);
  };

  useEffect(() => {
    let handleBeforeUnload: ((e: BeforeUnloadEvent) => void) | null = null;
    let handleUnload: (() => void) | null = null; 
    let handleVisibilityChange: (() => void) | null = null;
    let handleActivity: (() => void) | null = null;
    
    if (currentUser) {
      initializePresence();
      subscribeToUserStatus();
      setUserStatusOnline();
      startAutoMatching();
      resetIdleTimer();
      
      // Add event listeners for detecting when user leaves the site
      handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Immediately set user status to offline
        setUserStatusOffline();
        
        // Optional: Show warning if user is in active chat
        if (currentDirectChat || selectedRoom) {
          e.preventDefault();
          return e.returnValue = 'Are you sure you want to leave? Your chat will be disconnected.';
        }
      };

      handleUnload = () => {
        // Final cleanup when page unloads
        setUserStatusOffline();
        cleanupAllChannels();
      };

      handleVisibilityChange = () => {
        if (document.hidden) {
          // User switched to another tab or minimized browser
          setUserStatusOffline();
        } else {
          // User came back to the tab
          setUserStatusOnline();
          resetIdleTimer();
        }
      };

      // Track user activity to reset idle timer
      handleActivity = () => {
        resetIdleTimer();
      };

      // Add all event listeners
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('unload', handleUnload);
      window.addEventListener('pagehide', handleUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Activity listeners
      document.addEventListener('mousedown', handleActivity);
      document.addEventListener('mousemove', handleActivity);
      document.addEventListener('keypress', handleActivity);
      document.addEventListener('scroll', handleActivity);
      document.addEventListener('touchstart', handleActivity);
    }
    
    return () => {
      if (currentUser) {
        setUserStatusOffline();
        cleanupAllChannels();
      }
      
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      
      // Clean up event listeners
      if (handleBeforeUnload) {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      if (handleUnload) {
        window.removeEventListener('unload', handleUnload);
        window.removeEventListener('pagehide', handleUnload);
      }
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (handleActivity) {
        document.removeEventListener('mousedown', handleActivity);
        document.removeEventListener('mousemove', handleActivity);
        document.removeEventListener('keypress', handleActivity);
        document.removeEventListener('scroll', handleActivity);
        document.removeEventListener('touchstart', handleActivity);
      }
    };
  }, [currentUser, currentDirectChat, selectedRoom]);

  useEffect(() => {
    if (currentUser) {
      // Cleanup previous subscriptions when switching tabs/rooms
      const cleanup = [];
      
      if (activeTab === 'rooms' && selectedRoom) {
        loadMessages();
        loadParticipants();
        joinRoom();
        cleanup.push(subscribeToMessages());
        cleanup.push(subscribeToParticipants());
      } else if (activeTab === 'direct' && currentDirectChat) {
        loadDirectMessages();
        cleanup.push(subscribeToDirectMessages());
      }
      
      return () => {
        cleanup.forEach(fn => fn && fn());
      };
    }
  }, [selectedRoom, currentDirectChat, currentUser, activeTab]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, directMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadRooms = async () => {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('is_public', true);
    
    if (error) {
      console.error('Error loading rooms:', error);
      return;
    }
    
    setRooms(data || []);
  };

  const setUserStatusOnline = async () => {
    if (!currentUser) return;
    
    await supabase
      .from('casual_users')
      .update({ 
        status: 'available',
        last_active: new Date().toISOString()
      })
      .eq('id', currentUser.id);
  };

  const setUserStatusOffline = async () => {
    if (!currentUser) return;
    
    await supabase
      .from('casual_users')
      .update({ status: 'offline' })
      .eq('id', currentUser.id);
  };

  const setUserStatusMatched = async () => {
    if (!currentUser) return;
    
    await supabase
      .from('casual_users')
      .update({ status: 'matched' })
      .eq('id', currentUser.id);
  };


  const initializePresence = () => {
    if (!currentUser || presenceChannel) return;

    const channel = supabase
      .channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync');
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        // Check if the leaving user was our current chat partner
        if (randomMatch && key === randomMatch.id) {
          handlePartnerDisconnect();
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            username: currentUser.username,
            status: 'available',
            online_at: new Date().toISOString(),
          });
        }
      });

    setPresenceChannel(channel);
  };

  const subscribeToUserStatus = () => {
    if (!currentUser || userStatusChannel) return;

    const channel = supabase
      .channel('user-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'casual_users'
        },
        (payload) => {
          console.log('User status changed:', payload);
          
          // If our current partner went offline, handle disconnection
          if (payload.eventType === 'UPDATE' && 
              payload.new.status === 'offline' && 
              randomMatch && 
              payload.new.id === randomMatch.id) {
            handlePartnerDisconnect();
          }
          
          // If a new user comes online and we're looking for a match, try to connect
          if (payload.eventType === 'UPDATE' && 
              payload.new.status === 'available' && 
              !currentDirectChat && 
              !isSearchingForMatch &&
              payload.new.id !== currentUser.id) {
            setTimeout(() => {
              findRandomUser();
            }, 1000);
          }
        }
      )
      .subscribe();

    setUserStatusChannel(channel);
  };

  const cleanupAllChannels = () => {
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel);
      setPresenceChannel(null);
    }
    if (userStatusChannel) {
      supabase.removeChannel(userStatusChannel);
      setUserStatusChannel(null);
    }
  };

  const handlePartnerDisconnect = async () => {
    console.log('Partner disconnected, finding new match...');
    setRandomMatch(null);
    setCurrentDirectChat(null);
    setCurrentChatPartner('');
    setDirectMessages([]);
    
    // Update status to available and find new match
    await setUserStatusOnline();
    
    toast({
      title: "Partner disconnected",
      description: "Finding you a new person to chat with...",
    });
    
    // Wait a moment then find new match
    setTimeout(() => {
      findRandomUser();
    }, 2000);
  };

  const startAutoMatching = () => {
    // Auto-start matching when user logs in
    setTimeout(() => {
      findRandomUser();
    }, 1000);
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
        avatar_color: avatarColor
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

  const startDirectChat = async (targetUser: RoomParticipant) => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('direct_chats')
      .insert({
        user1_id: currentUser.id,
        user2_id: targetUser.user_id,
        user1_username: currentUser.username,
        user2_username: targetUser.username
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating direct chat:', error);
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setCurrentDirectChat(data);
    setCurrentChatPartner(targetUser.username);
    setActiveTab('direct');
    setDirectMessages([]);
    toast({
      title: "Chat started",
      description: `Started conversation with ${targetUser.username}`,
    });
  };

  const loadDirectMessages = async () => {
    if (!currentDirectChat) return;

    // Clear previous messages
    setDirectMessages([]);
  };

  const loadMessages = async () => {
    if (!selectedRoom) return;

    // Load only the last 10 messages for new users
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', selectedRoom.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    // Reverse to show messages in chronological order
    setMessages(data?.reverse() || []);
  };

  const loadParticipants = async () => {
    if (!selectedRoom) return;

    const { data, error } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', selectedRoom.id);

    if (error) {
      console.error('Error loading participants:', error);
      return;
    }

    setParticipants(data || []);
  };

  const joinRoom = async () => {
    if (!selectedRoom || !currentUser) return;

    const { error } = await supabase
      .from('room_participants')
      .upsert({
        room_id: selectedRoom.id,
        user_id: currentUser.id,
        username: currentUser.username
      });

    if (error) {
      console.error('Error joining room:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    if (activeTab === 'direct' && currentDirectChat) {
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
    } else if (activeTab === 'rooms' && selectedRoom) {
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: selectedRoom.id,
          user_id: currentUser.id,
          username: currentUser.username,
          content: newMessage.trim()
        });

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive"
        });
        return;
      }
    }

    setNewMessage('');
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser) return;

    if (activeTab === 'direct' && currentDirectChat) {
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
    } else if (activeTab === 'rooms' && selectedRoom) {
      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: selectedRoom.id,
          user_id: currentUser.id,
          username: currentUser.username,
          content: '',
          message_type: mediaType,
          media_url: mediaUrl
        });

      if (error) {
        console.error('Error sending media message:', error);
        return;
      }
    }
  };

  const subscribeToMessages = () => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`room-${selectedRoom.id}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToParticipants = () => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`room-${selectedRoom.id}-participants`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getCurrentChatPartner = () => {
    return currentChatPartner || (randomMatch ? randomMatch.username : '');
  };

  // Updated random user matching logic
  const findRandomUser = async () => {
    if (!currentUser) return;
    
    setIsSearchingForMatch(true);
    
    // Clear any existing timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      setReconnectTimeout(null);
    }
    
    try {
      // Get available users (excluding current user)
      const { data: availableUsers, error } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status', 'available')
        .neq('id', currentUser.id)
        .order('last_active', { ascending: false });
      
      if (error) {
        console.error('Error finding users:', error);
        setIsSearchingForMatch(false);
        return;
      }
      
      if (!availableUsers || availableUsers.length === 0) {
        setIsSearchingForMatch(false);
        toast({
          title: "No users available",
          description: "Waiting for someone to come online...",
        });
        
        // Try again in 5 seconds
        const timeout = setTimeout(() => {
          findRandomUser();
        }, 5000);
        setReconnectTimeout(timeout);
        return;
      }
      
      // Pick a random user
      const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
      
      // Set both users to matched status
      await Promise.all([
        setUserStatusMatched(),
        supabase
          .from('casual_users')
          .update({ status: 'matched' })
          .eq('id', randomUser.id)
      ]);
      
      setRandomMatch(randomUser);
      setIsSearchingForMatch(false);
      
      // Create direct chat
      await startRandomDirectChat(randomUser);
      
      toast({
        title: "Connected!",
        description: `You're now chatting with ${randomUser.username}`,
      });
      
    } catch (error) {
      console.error('Error in findRandomUser:', error);
      setIsSearchingForMatch(false);
    }
  };

  const startRandomDirectChat = async (targetUser: CasualUser) => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('direct_chats')
      .insert({
        user1_id: currentUser.id,
        user2_id: targetUser.id,
        user1_username: currentUser.username,
        user2_username: targetUser.username
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating direct chat:', error);
      return;
    }

    setCurrentDirectChat(data);
    setCurrentChatPartner(targetUser.username);
    setActiveTab('direct');
    setDirectMessages([]);
  };

  const leaveRandomChat = async () => {
    // Set both users back to available status
    if (randomMatch) {
      await supabase
        .from('casual_users')
        .update({ status: 'available' })
        .eq('id', randomMatch.id);
    }
    
    await setUserStatusOnline();
    
    setCurrentDirectChat(null);
    setCurrentChatPartner('');
    setRandomMatch(null);
    setDirectMessages([]);
    
    toast({
      title: "Chat ended",
      description: "Finding you a new person to chat with...",
    });
    
    // Find new user immediately
    setTimeout(() => {
      findRandomUser();
    }, 1000);
  };

  const skipToNextUser = () => {
    leaveRandomChat();
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
                    Stranger
                  </span>
                  <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
                    Chat
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
                Start private conversations or join group chat rooms. Connect instantly with strangers worldwide!
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
                variant="light-blue"
                className="w-full"
                size="lg"
              >
                {isJoining ? 'Joining...' : 'Start Chatting'}
              </Button>
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>💬 Private messaging</div>
                <div>🌍 Global chat rooms</div>
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
                Stranger
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
                Chat
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

      <div className="max-w-7xl mx-auto p-2 sm:p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-4 sm:mb-6">
            <TabsTrigger value="direct" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Private Chats
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-2">
              <Users className="w-4 h-4" />
              Chat Rooms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Random Chat Controls */}
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
                    
                    {currentDirectChat && randomMatch && (
                      <div className="space-y-2">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">Chatting with:</p>
                          <p className="text-lg font-semibold text-primary">{getCurrentChatPartner()}</p>
                        </div>
                        <Button 
                          onClick={skipToNextUser}
                          variant="outline"
                          className="w-full gap-2"
                        >
                          <SkipForward className="w-4 h-4" />
                          Next Person
                        </Button>
                        <Button 
                          onClick={leaveRandomChat}
                          variant="destructive"
                          size="sm"
                          className="w-full gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Leave Chat
                        </Button>
                      </div>
                    )}
                    
                    {!currentDirectChat && !isSearchingForMatch && reconnectTimeout && (
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Finding new person...
                        </p>
                      </div>
                    )}
                    
                    {!currentDirectChat && !isSearchingForMatch && !reconnectTimeout && (
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          No one available right now. We'll keep looking...
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Direct Chat Area */}
            <div className="lg:col-span-3">
              {currentDirectChat ? (
                <Card className="h-[500px] sm:h-[600px] flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-xl">Chatting with: {getCurrentChatPartner()}</h2>
                        <p className="text-sm text-muted-foreground">
                          {randomMatch ? 'Random conversation' : 'Private conversation'}
                        </p>
                      </div>
                      {randomMatch && (
                        <div className="flex gap-2">
                          <Button 
                            onClick={skipToNextUser}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <SkipForward className="w-3 h-3" />
                            Next
                          </Button>
                          <Button 
                            onClick={leaveRandomChat}
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                          >
                            <LogOut className="w-3 h-3" />
                            Leave
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {directMessages.map((message) => (
                      <div key={message.id} className="flex gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                          style={{ backgroundColor: avatarColors[message.sender_username.charCodeAt(0) % avatarColors.length] }}
                        >
                          {message.sender_username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-sm">{message.sender_username}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <MessageRenderer 
                            content={message.content}
                            messageType={message.message_type || 'text'}
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
                        placeholder="Type your message..."
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
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Random Anonymous Chat</h3>
                    {isSearchingForMatch ? (
                      <div>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                        <p className="mb-4">Finding someone to chat with...</p>
                      </div>
                    ) : (
                      <p className="mb-4">We're automatically connecting you with strangers worldwide</p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Room List */}
            <div className="lg:col-span-1">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Chat Rooms
                  </h3>
                  <div className="space-y-2">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedRoom?.id === room.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium">{room.name}</div>
                        <div className="text-xs opacity-70">{room.description}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Room Chat Area */}
            <div className="lg:col-span-1">
              {selectedRoom ? (
                <Card className="h-[500px] sm:h-[600px] flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-xl">Room: {selectedRoom?.name}</h2>
                        <p className="text-sm text-muted-foreground">{selectedRoom?.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className="flex gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                          style={{ backgroundColor: avatarColors[message.username.charCodeAt(0) % avatarColors.length] }}
                        >
                          {message.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-sm">{message.username}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <MessageRenderer 
                            content={message.content}
                            messageType={message.message_type || 'text'}
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
                        placeholder="Type your message..."
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
                  <div className="text-center text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Select a chat room</h3>
                    <p>Choose a room to join the conversation</p>
                  </div>
                </Card>
              )}
            </div>

          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Chat;