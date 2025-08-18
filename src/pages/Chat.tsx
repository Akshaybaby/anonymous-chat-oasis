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
  const [onlineUsers, setOnlineUsers] = useState<CasualUser[]>([]);
  
  // Realtime channels
  const userPresenceChannelRef = useRef<any>(null);
  const directMessagesChannelRef = useRef<any>(null);
  const partnerStatusChannelRef = useRef<any>(null);
  const matchingChannelRef = useRef<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);
  
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  // Restore user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('casual_user');
    const savedChat = localStorage.getItem('current_chat');
    const savedPartner = localStorage.getItem('chat_partner');
    
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      
      // Restore chat if exists
      if (savedChat && savedPartner) {
        setCurrentDirectChat(JSON.parse(savedChat));
        setCurrentChatPartner(JSON.parse(savedPartner));
      }
    }
  }, []);

  // Main user lifecycle management
  useEffect(() => {
    if (currentUser) {
      setUserOnline();
      setupRealtimeSubscriptions();
      startHeartbeat();
      
      // Start matching if no current chat
      if (!currentDirectChat) {
        startMatching();
      }
      
      addActivityListeners();
      
      return () => {
        isUnmountingRef.current = true;
        cleanupAllChannels();
        stopHeartbeat();
        stopMatching();
        removeActivityListeners();
      };
    }
  }, [currentUser]);

  // Direct chat management
  useEffect(() => {
    if (currentUser && currentDirectChat) {
      loadDirectMessages();
      setupDirectMessageSubscription();
      setupPartnerStatusSubscription();
      
      // Save to localStorage for session persistence
      localStorage.setItem('current_chat', JSON.stringify(currentDirectChat));
      if (currentChatPartner) {
        localStorage.setItem('chat_partner', JSON.stringify(currentChatPartner));
      }
    }
    
    return () => {
      cleanupDirectMessageSubscription();
      cleanupPartnerStatusSubscription();
    };
  }, [currentDirectChat, currentUser]);

  // Auto-scroll messages
  useEffect(() => {
    scrollToBottom();
  }, [directMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Heartbeat system for maintaining online presence
  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) return;
    
    heartbeatIntervalRef.current = setInterval(async () => {
      if (currentUser && !isUnmountingRef.current) {
        await supabase
          .from('casual_users')
          .update({ 
            last_active: new Date().toISOString(),
            status: currentDirectChat ? 'matched' : 'available'
          })
          .eq('id', currentUser.id);
      }
    }, 15000); // Update every 15 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const startMatching = () => {
    if (matchingIntervalRef.current || currentDirectChat) return;
    
    setIsSearchingForMatch(true);
    tryMatch(); // Try immediately
    
    matchingIntervalRef.current = setInterval(() => {
      if (!currentDirectChat && currentUser) {
        tryMatch();
      }
    }, 3000); // Try every 3 seconds
  };

  const stopMatching = () => {
    setIsSearchingForMatch(false);
    if (matchingIntervalRef.current) {
      clearInterval(matchingIntervalRef.current);
      matchingIntervalRef.current = null;
    }
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
        status: 'available',
        last_active: new Date().toISOString()
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
    localStorage.setItem('casual_user', JSON.stringify(data));
    setIsJoining(false);
  };

  const setUserOnline = async () => {
    if (!currentUser) return;
    
    await supabase
      .from('casual_users')
      .update({ 
        status: currentDirectChat ? 'matched' : 'available',
        last_active: new Date().toISOString()
      })
      .eq('id', currentUser.id);
  };

  const setUserOffline = async () => {
    if (!currentUser) return;
    
    // Use sendBeacon for reliable offline status when page unloads
    const offlineData = {
      user_id: currentUser.id,
      partner_id: currentChatPartner?.id,
      timestamp: new Date().toISOString()
    };
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/user-offline', JSON.stringify(offlineData));
    }
    
    // Also try regular update
    await supabase
      .from('casual_users')
      .update({ 
        status: 'offline',
        last_active: new Date().toISOString()
      })
      .eq('id', currentUser.id);
    
    // Clear localStorage
    localStorage.removeItem('casual_user');
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
  };

  // Setup all realtime subscriptions
  const setupRealtimeSubscriptions = () => {
    setupUserPresenceSubscription();
    setupMatchingSubscription();
  };

  const setupUserPresenceSubscription = () => {
    if (userPresenceChannelRef.current) return;

    userPresenceChannelRef.current = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'casual_users'
        },
        (payload) => {
          console.log('User presence change:', payload);
          
          if (payload.eventType === 'UPDATE') {
            handleUserStatusChange(payload.new as CasualUser, payload.old as CasualUser);
          } else if (payload.eventType === 'INSERT') {
            handleNewUser(payload.new as CasualUser);
          } else if (payload.eventType === 'DELETE') {
            handleUserLeft(payload.old as CasualUser);
          }
          
          updateOnlineUsersList();
        }
      )
      .subscribe((status) => {
        console.log('User presence subscription status:', status);
      });
  };

  const setupMatchingSubscription = () => {
    if (matchingChannelRef.current) return;

    matchingChannelRef.current = supabase
      .channel('matching-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_chats'
        },
        (payload) => {
          const newChat = payload.new as DirectChat;
          
          // Check if this chat involves current user
          if (currentUser && (newChat.user1_id === currentUser.id || newChat.user2_id === currentUser.id)) {
            const partnerId = newChat.user1_id === currentUser.id ? newChat.user2_id : newChat.user1_id;
            const partnerUsername = newChat.user1_id === currentUser.id ? newChat.user2_username : newChat.user1_username;
            
            // Find partner details
            supabase
              .from('casual_users')
              .select('*')
              .eq('id', partnerId)
              .single()
              .then(({ data: partner }) => {
                if (partner) {
                  setCurrentChatPartner(partner);
                  setCurrentDirectChat(newChat);
                  setDirectMessages([]);
                  stopMatching();
                  
                  toast({
                    title: "Connected!",
                    description: `You're now chatting with ${partnerUsername}`,
                  });
                }
              });
          }
        }
      )
      .subscribe((status) => {
        console.log('Matching subscription status:', status);
      });
  };

  const setupDirectMessageSubscription = () => {
    if (!currentDirectChat || directMessagesChannelRef.current) return;

    directMessagesChannelRef.current = supabase
      .channel(`direct-messages-${currentDirectChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_id=eq.${currentDirectChat.id}`
        },
        (payload) => {
          const newMessage = payload.new as DirectMessage;
          console.log('New direct message:', newMessage);
          
          setDirectMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            
            return [...prev, newMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('Direct messages subscription status:', status);
      });
  };

  const setupPartnerStatusSubscription = () => {
    if (!currentChatPartner || partnerStatusChannelRef.current) return;

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
          console.log('Partner status change:', updatedPartner);
          
          if (updatedPartner.status === 'offline') {
            handlePartnerDisconnect(updatedPartner.username);
          }
        }
      )
      .subscribe((status) => {
        console.log('Partner status subscription status:', status);
      });
  };

  const handleUserStatusChange = (newUser: CasualUser, oldUser: CasualUser) => {
    // If our partner went offline
    if (currentChatPartner && newUser.id === currentChatPartner.id && newUser.status === 'offline') {
      handlePartnerDisconnect(newUser.username);
    }
    
    // Update online users list
    setOnlineUsers(prev => {
      const filtered = prev.filter(u => u.id !== newUser.id);
      if (newUser.status === 'available' || newUser.status === 'matched') {
        return [...filtered, newUser];
      }
      return filtered;
    });
  };

  const handleNewUser = (newUser: CasualUser) => {
    if (newUser.status === 'available' || newUser.status === 'matched') {
      setOnlineUsers(prev => {
        const exists = prev.some(u => u.id === newUser.id);
        if (exists) return prev;
        return [...prev, newUser];
      });
    }
  };

  const handleUserLeft = (user: CasualUser) => {
    setOnlineUsers(prev => prev.filter(u => u.id !== user.id));
    
    if (currentChatPartner && user.id === currentChatPartner.id) {
      handlePartnerDisconnect(user.username);
    }
  };

  const handlePartnerDisconnect = async (partnerName: string) => {
    console.log('Partner disconnected:', partnerName);
    
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    
    // Clear localStorage
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    
    // Update status back to available
    if (currentUser) {
      await supabase
        .from('casual_users')
        .update({ status: 'available' })
        .eq('id', currentUser.id);
    }
    
    toast({
      title: "Partner disconnected",
      description: `${partnerName} left the chat. Finding you someone new...`,
    });
    
    // Start matching again
    startMatching();
  };

  const updateOnlineUsersList = async () => {
    const { data: users, error } = await supabase
      .from('casual_users')
      .select('*')
      .in('status', ['available', 'matched'])
      .gte('last_active', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Active in last 5 minutes
      .order('last_active', { ascending: false });
    
    if (!error && users) {
      setOnlineUsers(users);
    }
  };

  const tryMatch = async () => {
    if (!currentUser || currentDirectChat || !isSearchingForMatch) return;
    
    try {
      // Find available users
      const { data: availableUsers, error } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status', 'available')
        .neq('id', currentUser.id)
        .gte('last_active', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Active in last 2 minutes
        .limit(10);
      
      if (error || !availableUsers || availableUsers.length === 0) {
        return;
      }
      
      // Pick random user
      const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
      
      // Update both users to matched status atomically
      const { error: updateError } = await supabase.rpc('atomic_match_users', {
        user1_id: currentUser.id,
        user2_id: randomUser.id
      });
      
      if (updateError) {
        console.error('Match failed:', updateError);
        return;
      }
      
      // Create direct chat
      const { data: chatData, error: chatError } = await supabase
        .from('direct_chats')
        .insert({
          user1_id: currentUser.id,
          user2_id: randomUser.id,
          user1_username: currentUser.username,
          user2_username: randomUser.username,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (chatError) {
        console.error('Error creating chat:', chatError);
        // Revert status changes
        await Promise.all([
          supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id),
          supabase.from('casual_users').update({ status: 'available' }).eq('id', randomUser.id)
        ]);
        return;
      }

      setCurrentChatPartner(randomUser);
      setCurrentDirectChat(chatData);
      setDirectMessages([]);
      stopMatching();
      
      toast({
        title: "Connected!",
        description: `You're now chatting with ${randomUser.username}`,
      });
      
    } catch (error) {
      console.error('Error in matching:', error);
    }
  };

  const skipToNextUser = async () => {
    if (!currentChatPartner) return;
    
    const partnerName = currentChatPartner.username;
    
    // Set partner back to available
    await supabase
      .from('casual_users')
      .update({ status: 'available' })
      .eq('id', currentChatPartner.id);
    
    // Set self to available
    await supabase
      .from('casual_users')
      .update({ status: 'available' })
      .eq('id', currentUser!.id);
    
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    
    // Clear localStorage
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    
    toast({
      title: "Finding new person",
      description: `Left chat with ${partnerName}. Looking for someone new...`,
    });
    
    startMatching();
  };

  const loadDirectMessages = async () => {
    if (!currentDirectChat) return;
    
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', currentDirectChat.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading direct messages:', error);
      return;
    }

    setDirectMessages(data || []);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !currentDirectChat) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        chat_id: currentDirectChat.id,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        content: messageContent
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

    // Update last_message_at
    await supabase
      .from('direct_chats')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', currentDirectChat.id);
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

  // Activity listeners for detecting user presence
  const addActivityListeners = () => {
    const handleActivity = () => {
      if (currentUser && !isUnmountingRef.current) {
        supabase
          .from('casual_users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', currentUser.id);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentUser) {
        setUserOffline();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tabs - mark as away after delay
        setTimeout(() => {
          if (document.hidden && currentUser && !isUnmountingRef.current) {
            supabase
              .from('casual_users')
              .update({ 
                last_active: new Date().toISOString(),
                status: 'away'
              })
              .eq('id', currentUser.id);
          }
        }, 30000); // 30 seconds delay
      } else if (currentUser) {
        // User came back - mark as available/matched
        supabase
          .from('casual_users')
          .update({ 
            status: currentDirectChat ? 'matched' : 'available',
            last_active: new Date().toISOString()
          })
          .eq('id', currentUser.id);
      }
    };

    // Activity events
    const events = ['mousedown', 'keypress', 'touchstart', 'scroll', 'mousemove', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Store cleanup function
    (window as any)._chatActivityCleanup = () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  };

  const removeActivityListeners = () => {
    if ((window as any)._chatActivityCleanup) {
      (window as any)._chatActivityCleanup();
      delete (window as any)._chatActivityCleanup;
    }
  };

  // Cleanup functions
  const cleanupAllChannels = () => {
    cleanupUserPresenceSubscription();
    cleanupMatchingSubscription();
    cleanupDirectMessageSubscription();
    cleanupPartnerStatusSubscription();
  };

  const cleanupUserPresenceSubscription = () => {
    if (userPresenceChannelRef.current) {
      supabase.removeChannel(userPresenceChannelRef.current);
      userPresenceChannelRef.current = null;
    }
  };

  const cleanupMatchingSubscription = () => {
    if (matchingChannelRef.current) {
      supabase.removeChannel(matchingChannelRef.current);
      matchingChannelRef.current = null;
    }
  };

  const cleanupDirectMessageSubscription = () => {
    if (directMessagesChannelRef.current) {
      supabase.removeChannel(directMessagesChannelRef.current);
      directMessagesChannelRef.current = null;
    }
  };

  const cleanupPartnerStatusSubscription = () => {
    if (partnerStatusChannelRef.current) {
      supabase.removeChannel(partnerStatusChannelRef.current);
      partnerStatusChannelRef.current = null;
    }
  };

  if (!currentUser) {
    return (
      <>
        <Helmet>
          <title>Talk with Stranger - Anonymous Chat with Random People Online</title>
          <meta name="description" content="Connect with random strangers worldwide for anonymous chat. Safe, instant, and free stranger chat platform. Meet new people and have meaningful conversations." />
          <meta name="keywords" content="stranger chat, anonymous chat, random chat, talk to strangers, online chat, meet strangers, free chat, video chat strangers" />
          <meta property="og:title" content="Talk with Stranger - Anonymous Chat Platform" />
          <meta property="og:description" content="Connect with random strangers worldwide for anonymous chat. Safe, instant, and free." />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Talk with Stranger - Anonymous Chat" />
          <meta name="twitter:description" content="Connect with random strangers worldwide for anonymous chat." />
          <link rel="canonical" href="https://yoursite.com/chat" />
        </Helmet>
        
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
                  <div className="mt-4 text-xs">
                    {onlineUsers.length} people online now
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Chatting with {currentChatPartner?.username || 'Strangers'} - Talk with Stranger</title>
        <meta name="description" content="Anonymous chat session in progress. Connect with random strangers for meaningful conversations." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
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
                    {/* Online Users Count */}
                    <div className="p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium">
                          {onlineUsers.length} online now
                        </span>
                      </div>
                    </div>

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
                          <div className="flex items-center gap-2 mt-1">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                              style={{ backgroundColor: currentChatPartner.avatar_color }}
                            >
                              {currentChatPartner.username.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-lg font-semibold text-primary">{currentChatPartner.username}</p>
                          </div>
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

              {/* Online Users List */}
              <Card className="hidden lg:block">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">People Online</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {onlineUsers.slice(0, 10).map((user) => (
                      <div key={user.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <div 
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                          style={{ backgroundColor: user.avatar_color }}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {user.username}
                        </span>
                        <div className={`w-2 h-2 rounded-full ml-auto ${
                          user.status === 'available' ? 'bg-green-500' : 
                          user.status === 'matched' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}></div>
                      </div>
                    ))}
                    {onlineUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No users online
                      </p>
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
                        <h2 className="font-semibold text-lg sm:text-xl">
                          Chatting with: {currentChatPartner?.username}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Random conversation • {directMessages.length} messages
                        </p>
                      </div>
                      <Button 
                        onClick={skipToNextUser}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <SkipForward className="w-3 h-3" />
                        <span className="hidden sm:inline">Next</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                          className={`max-w-[70%] sm:max-w-[80%] px-3 py-2 rounded-lg ${
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
                      <MediaUpload onMediaUploaded={sendMediaMessage} />
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        className="flex-1"
                        disabled={!currentDirectChat}
                      />
                      <Button 
                        onClick={sendMessage} 
                        size="icon"
                        disabled={!newMessage.trim() || !currentDirectChat}
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
                <Card className="h-[500px] sm:h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {isSearchingForMatch ? 'Finding Someone...' : 'No Active Chat'}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {isSearchingForMatch 
                        ? "We're searching for an available person to chat with. This usually takes just a few seconds!" 
                        : "Waiting to match you with someone online..."
                      }
                    </p>
                    {isSearchingForMatch && (
                      <div className="mt-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      </div>
                    )}
                    <div className="mt-6 text-sm text-muted-foreground">
                      <p>{onlineUsers.length} people online now</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile-friendly bottom info */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-2">
          <div className="text-center text-xs text-muted-foreground">
            {onlineUsers.length} people online • Anonymous chat
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
