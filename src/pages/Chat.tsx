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
  status: string;
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
  const [currentChatPartner, setCurrentChatPartner] = useState<CasualUser | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [activeTab, setActiveTab] = useState('direct');
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [userPresenceChannel, setUserPresenceChannel] = useState<any>(null);
  const [messageChannels, setMessageChannels] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  // Load chat rooms on mount
  useEffect(() => {
    loadRooms();
  }, []);

  // Main user lifecycle management
  useEffect(() => {
    if (currentUser) {
      setUserOnline();
      subscribeToUserPresence();
      subscribeToMatchingEvents();
      // Start matching immediately when user comes online
      setTimeout(startMatching, 500); // Small delay to ensure subscriptions are ready
      addActivityListeners();
      
      return () => {
        setUserOffline();
        cleanupAllChannels();
        removeActivityListeners();
      };
    }
  }, [currentUser]);

  // Message subscriptions based on active chat
  useEffect(() => {
    cleanupMessageChannels();
    
    if (currentUser) {
      if (activeTab === 'rooms' && selectedRoom) {
        loadMessages();
        loadParticipants();
        joinRoom();
        subscribeToRoomMessages();
        subscribeToParticipants();
      } else if (activeTab === 'direct' && currentDirectChat) {
        loadDirectMessages();
        subscribeToDirectMessages();
      }
    }
  }, [selectedRoom, currentDirectChat, currentUser, activeTab]);

  // Auto-scroll messages
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
          event: '*',
          schema: 'public',
          table: 'casual_users'
        },
        (payload) => {
          console.log('User status change:', payload);
          if (payload.eventType === 'UPDATE') {
            handleUserStatusChange(payload.new as CasualUser);
          } else if (payload.eventType === 'INSERT') {
            handleNewUserJoined(payload.new as CasualUser);
          }
        }
      )
      .subscribe();

    setUserPresenceChannel(channel);
  };

  // Subscribe to direct chat creation for both parties
  const subscribeToMatchingEvents = () => {
    if (!currentUser) return;

    const channel = supabase
      .channel('direct-chats-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_chats'
        },
        (payload) => {
          const newChat = payload.new as DirectChat;
          console.log('New direct chat created:', newChat);
          // If this chat involves the current user, set it up
          if ((newChat.user1_id === currentUser?.id || newChat.user2_id === currentUser?.id) && 
              !currentDirectChat) {
            handleNewDirectChat(newChat);
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
  };

  const handleNewUserJoined = (user: CasualUser) => {
    console.log('New user joined:', user);
    // If a new user joins and we need a match, try to connect immediately
    if (user.status === 'available' && 
        !currentDirectChat && 
        !isSearchingForMatch &&
        user.id !== currentUser?.id) {
      setTimeout(() => tryMatch(), 200); // Small delay to avoid race conditions
    }
  };

  const handleNewDirectChat = async (chat: DirectChat) => {
    console.log('Handling new direct chat:', chat);
    if (!currentUser) return;

    let partner: CasualUser | null = null;
    
    if (chat.user1_id === currentUser.id) {
      // We are user1, partner is user2
      const { data } = await supabase
        .from('casual_users')
        .select('*')
        .eq('id', chat.user2_id)
        .single();
      partner = data;
    } else if (chat.user2_id === currentUser.id) {
      // We are user2, partner is user1  
      const { data } = await supabase
        .from('casual_users')
        .select('*')
        .eq('id', chat.user1_id)
        .single();
      partner = data;
    }

    if (partner) {
      setCurrentChatPartner(partner);
      setCurrentDirectChat(chat);
      setDirectMessages([]);
      setActiveTab('direct');
      setIsSearchingForMatch(false);
      
      toast({
        title: "Connected!",
        description: `You're now chatting with ${partner.username}`,
      });
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

  // Matching system - atomic operations for instant matching
  const startMatching = () => {
    if (!currentUser || currentDirectChat) return;
    console.log('Starting matching for user:', currentUser.username);
    tryMatch(); // Immediate matching
  };

  const tryMatch = async () => {
    if (!currentUser || currentDirectChat || isSearchingForMatch) return;
    
    console.log('Trying to match user:', currentUser.username);
    setIsSearchingForMatch(true);
    
    try {
      // Use atomic transaction to find and match users safely
      const { data: availableUsers, error } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status', 'available')
        .neq('id', currentUser.id)
        .limit(10); // Limit to prevent too many options
      
      if (error) {
        console.error('Error finding users:', error);
        setIsSearchingForMatch(false);
        return;
      }
      
      if (!availableUsers || availableUsers.length === 0) {
        console.log('No available users found, waiting...');
        setIsSearchingForMatch(false);
        return;
      }
      
      console.log('Found available users:', availableUsers.length);
      
      // Random matching - pick a random available user
      const randomIndex = Math.floor(Math.random() * availableUsers.length);
      const matchUser = availableUsers[randomIndex];
      
      console.log('Attempting to match with:', matchUser.username);
      
      // Try manual atomic update - check and update both users
      const { data: checkUser, error: checkError } = await supabase
        .from('casual_users')
        .select('status')
        .eq('id', matchUser.id)
        .single();
      
      if (checkError || checkUser?.status !== 'available') {
        console.log('User no longer available:', matchUser.username);
        setIsSearchingForMatch(false);
        // Try again immediately with different user
        setTimeout(tryMatch, 100);
        return;
      }
      
      // Update both users to matched
      await Promise.all([
        supabase.from('casual_users').update({ status: 'matched' }).eq('id', currentUser.id),
        supabase.from('casual_users').update({ status: 'matched' }).eq('id', matchUser.id)
      ]);
      
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

      console.log('Successfully matched and created chat:', chatData);
      
      // The handleNewDirectChat will be triggered by the realtime subscription
      // for both users, so we don't need to manually set the state here
      
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

  // Message management
  const loadMessages = async () => {
    if (!selectedRoom) return;

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

    setMessages(data?.reverse() || []);
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

  // Realtime message subscriptions
  const subscribeToRoomMessages = () => {
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

    setMessageChannels(prev => [...prev, channel]);
  };

  const subscribeToDirectMessages = () => {
    if (!currentDirectChat) return;

    console.log('Subscribing to direct messages for chat:', currentDirectChat.id);

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
          console.log('New direct message received:', payload.new);
          const newMessage = payload.new as DirectMessage;
          setDirectMessages(prev => {
            // Avoid duplicates by checking if message already exists
            if (prev.find(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('Direct messages subscription status:', status);
      });

    setMessageChannels(prev => [...prev, channel]);
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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Use sendBeacon for guaranteed delivery during page unload
      if (currentUser) {
        navigator.sendBeacon(`https://gqfrnzlmporencfbofoi.supabase.co/rest/v1/casual_users?id=eq.${currentUser.id}`, 
          JSON.stringify({ status: 'offline' }));
      }
      setUserOffline();
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

    // Page focus/blur for more reliable disconnect detection
    const handlePageBlur = () => setUserOffline();
    const handlePageFocus = () => {
      if (currentUser) setUserOnline();
    };

    // Add listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handlePageBlur);
    window.addEventListener('focus', handlePageFocus);
    document.addEventListener('mousedown', handleActivity);
    document.addEventListener('keypress', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    // Store cleanup function
    (window as any)._chatActivityCleanup = () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handlePageBlur);
      window.removeEventListener('focus', handlePageFocus);
      document.removeEventListener('mousedown', handleActivity);
      document.removeEventListener('keypress', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
    };

    // Auto-offline after 4 minutes of inactivity
    let inactivityTimeout: NodeJS.Timeout;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        if (currentUser) {
          setUserOffline();
          toast({
            title: "You've been logged out",
            description: "Due to inactivity, you've been logged out.",
            variant: "destructive"
          });
        }
      }, 4 * 60 * 1000);
    };

    document.addEventListener('mousedown', resetInactivityTimer);
    document.addEventListener('keypress', resetInactivityTimer);
    document.addEventListener('touchstart', resetInactivityTimer);
    resetInactivityTimer();
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
            {/* Private Chat Status */}
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

            {/* Direct Chat Area */}
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
          </TabsContent>

          <TabsContent value="rooms" className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Room List */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Chat Rooms</h3>
                  <div className="space-y-2">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedRoom?.id === room.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <div className="font-medium">{room.name}</div>
                        <div className="text-xs opacity-70">{room.description}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Participants */}
              {selectedRoom && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">
                      Online ({participants.length})
                    </h3>
                    <div className="space-y-2">
                      {participants.map((participant) => (
                        <div key={participant.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">{participant.username}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-3">
              {selectedRoom ? (
                <Card className="h-[500px] sm:h-[600px] flex flex-col">
                  <div className="p-4 border-b">
                    <h2 className="font-semibold text-xl">{selectedRoom.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedRoom.description}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.username === currentUser.username ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-lg ${
                            message.username === currentUser.username
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {message.username}
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
                        placeholder={`Message ${selectedRoom.name}...`}
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
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Chat Room</h3>
                    <p className="text-muted-foreground">
                      Choose a room from the sidebar to start chatting with the community
                    </p>
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
