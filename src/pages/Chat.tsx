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
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Realtime channels
  const channelsRef = useRef({
    directMessages: null as any,
    partnerStatus: null as any,
    matching: null as any,
    globalMessages: null as any,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  // Enhanced scroll to bottom with instant scrolling for better UX
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'instant',
        block: 'end'
      });
    });
  }, []);

  // Connection monitoring
  const checkConnection = useCallback(async () => {
    try {
      const { error } = await supabase.from('casual_users').select('id').limit(1);
      setIsConnected(!error);
      return !error;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, []);

  // Auto-reconnect mechanism
  const handleReconnection = useCallback(async () => {
    if (isUnmountingRef.current) return;
    
    const isOnline = await checkConnection();
    if (!isOnline) {
      reconnectTimeoutRef.current = setTimeout(() => {
        handleReconnection();
      }, 2000);
      return;
    }

    if (currentUser) {
      await setupRealtimeSubscriptions();
      if (currentDirectChat) {
        await setupDirectMessageSubscription();
        await setupPartnerStatusSubscription();
      }
    }
  }, [currentUser, currentDirectChat]);

  // Restore user session on mount
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

    checkConnection();
  }, [checkConnection]);

  // Optimized heartbeat for maintaining connection
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return;
    
    const updatePresence = async () => {
      if (!currentUser || isUnmountingRef.current) return;
      
      try {
        await supabase
          .from('casual_users')
          .update({ 
            last_active: new Date().toISOString(),
            status: currentDirectChat ? 'matched' : 'available'
          })
          .eq('id', currentUser.id);
      } catch (error) {
        console.error('Heartbeat failed:', error);
        handleReconnection();
      }
    };

    updatePresence();
    heartbeatIntervalRef.current = setInterval(updatePresence, 8000); // Every 8 seconds
  }, [currentUser, currentDirectChat, handleReconnection]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Aggressive matching system for instant connections
  const startMatching = useCallback(() => {
    if (matchingIntervalRef.current || currentDirectChat || !currentUser) return;
    
    setIsSearchingForMatch(true);
    
    const attemptMatch = async () => {
      if (currentDirectChat || !currentUser || isUnmountingRef.current) return;
      
      try {
        const { data: availableUsers, error } = await supabase
          .from('casual_users')
          .select('*')
          .eq('status', 'available')
          .neq('id', currentUser.id)
          .gte('last_active', new Date(Date.now() - 30 * 1000).toISOString()) // Active in last 30 seconds
          .order('last_active', { ascending: false })
          .limit(3);
        
        if (error || !availableUsers || availableUsers.length === 0) {
          return;
        }
        
        const targetUser = availableUsers[0];
        
        const { data: matchResult, error: matchError } = await supabase.rpc('atomic_match_users', {
          user1_id: currentUser.id,
          user2_id: targetUser.id
        });
        
        if (matchError || !matchResult) return;
        
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

        if (chatError) {
          await Promise.all([
            supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id),
            supabase.from('casual_users').update({ status: 'available' }).eq('id', targetUser.id)
          ]);
          return;
        }

        setCurrentChatPartner(targetUser);
        setCurrentDirectChat(chatData);
        setDirectMessages([]);
        stopMatching();
        
        toast({
          title: "Connected!",
          description: `You're now chatting with ${targetUser.username}`,
        });
        
        // Focus input for immediate typing
        setTimeout(() => inputRef.current?.focus(), 100);
        
      } catch (error) {
        console.error('Error in matching:', error);
      }
    };

    attemptMatch();
    matchingIntervalRef.current = setInterval(attemptMatch, 1500); // Try every 1.5 seconds
  }, [currentUser, currentDirectChat, toast]);

  const stopMatching = useCallback(() => {
    setIsSearchingForMatch(false);
    if (matchingIntervalRef.current) {
      clearInterval(matchingIntervalRef.current);
      matchingIntervalRef.current = null;
    }
  }, []);

  // Streamlined realtime subscriptions
  const setupRealtimeSubscriptions = useCallback(async () => {
    if (!currentUser) return;

    Object.values(channelsRef.current).forEach(channel => {
      if (channel) supabase.removeChannel(channel);
    });

    // Matching subscription
    channelsRef.current.matching = supabase
      .channel('matching-events', { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_chats'
        },
        async (payload) => {
          if (isUnmountingRef.current) return;
          
          try {
            const newChat = payload.new as DirectChat;
            
            if (currentUser && (newChat.user1_id === currentUser.id || newChat.user2_id === currentUser.id)) {
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
                stopMatching();
                
                toast({
                  title: "Connected!",
                  description: `You're now chatting with ${partnerUsername}`,
                });

                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }
          } catch (error) {
            console.error('Error handling new chat:', error);
          }
        }
      )
      .subscribe();
  }, [currentUser, toast, stopMatching]);

  const setupDirectMessageSubscription = useCallback(() => {
    if (!currentDirectChat || channelsRef.current.directMessages) return;

    // Enhanced real-time subscription with immediate updates
    channelsRef.current.directMessages = supabase
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
          if (isUnmountingRef.current) return;
          
          try {
            const newMessage = payload.new as DirectMessage;
            console.log('Real-time message received:', newMessage);
            
            // Immediate state update for real-time experience
            setDirectMessages(prev => {
              // Prevent duplicates
              if (prev.some(msg => msg.id === newMessage.id)) return prev;
              
              // Add new message and sort chronologically
              const updatedMessages = [...prev, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              
              return updatedMessages;
            });
            
            // Auto-scroll to new message
            requestAnimationFrame(() => scrollToBottom());
            
          } catch (error) {
            console.error('Error handling real-time message:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public', 
          table: 'direct_messages',
          filter: `chat_id=eq.${currentDirectChat.id}`
        },
        (payload) => {
          if (isUnmountingRef.current) return;
          
          try {
            const updatedMessage = payload.new as DirectMessage;
            
            setDirectMessages(prev =>
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          } catch (error) {
            console.error('Error handling message update:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Direct messages subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to direct messages');
        }
      });
  }, [currentDirectChat, scrollToBottom]);

  const setupPartnerStatusSubscription = useCallback(() => {
    if (!currentChatPartner || channelsRef.current.partnerStatus) return;

    channelsRef.current.partnerStatus = supabase
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
          if (isUnmountingRef.current) return;
          
          try {
            const updatedPartner = payload.new as CasualUser;
            
            if (updatedPartner.status === 'offline') {
              handlePartnerDisconnect(updatedPartner.username);
            } else {
              setCurrentChatPartner(updatedPartner);
            }
          } catch (error) {
            console.error('Error handling partner status change:', error);
          }
        }
      )
      .subscribe();
  }, [currentChatPartner]);

  const handlePartnerDisconnect = useCallback(async (partnerName: string) => {
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    
    if (currentUser) {
      try {
        await supabase
          .from('casual_users')
          .update({ status: 'available' })
          .eq('id', currentUser.id);
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    }
    
    toast({
      title: "Partner disconnected",
      description: `${partnerName} left the chat. Finding you someone new...`,
    });
    
    setTimeout(() => startMatching(), 500);
  }, [currentUser, toast, startMatching]);

  // Ultra-fast message sending with enhanced real-time updates
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUser || !currentDirectChat) return;

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    
    const tempMessage: DirectMessage = {
      id: tempId,
      content: messageContent,
      sender_username: currentUser.username,
      sender_id: currentUser.id,
      created_at: now,
      message_type: 'text'
    };

    // Instant UI update for immediate feedback
    setDirectMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    
    // Immediate scroll
    requestAnimationFrame(() => scrollToBottom());

    try {
      // Send to database
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: currentDirectChat.id,
          sender_id: currentUser.id,
          sender_username: currentUser.username,
          content: messageContent,
          created_at: now
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temporary message with real one
      setDirectMessages(prev => 
        prev.map(msg => msg.id === tempId ? data : msg)
      );

      // Update chat timestamp asynchronously
      supabase
        .from('direct_chats')
        .update({ last_message_at: now })
        .eq('id', currentDirectChat.id)
        .then(null, (err) => console.error('Chat update error:', err));

      console.log('Message sent successfully:', data);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove failed message and restore input
      setDirectMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageContent);
      
      toast({
        title: "Failed to send",
        description: "Message couldn't be delivered. Try again.",
        variant: "destructive"
      });
    }
  }, [newMessage, currentUser, currentDirectChat, scrollToBottom, toast]);

  const sendMediaMessage = useCallback(async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser || !currentDirectChat) return;

    const tempId = `temp-media-${Date.now()}-${Math.random()}`;
    const tempMessage: DirectMessage = {
      id: tempId,
      content: '',
      sender_username: currentUser.username,
      sender_id: currentUser.id,
      created_at: new Date().toISOString(),
      message_type: mediaType,
      media_url: mediaUrl
    };

    setDirectMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: currentDirectChat.id,
          sender_id: currentUser.id,
          sender_username: currentUser.username,
          content: '',
          message_type: mediaType,
          media_url: mediaUrl
        })
        .select()
        .single();

      if (error) throw error;

      setDirectMessages(prev => 
        prev.map(msg => msg.id === tempId ? data : msg)
      );

      supabase
        .from('direct_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', currentDirectChat.id)
        .then(null, console.error);

    } catch (error) {
      console.error('Error sending media message:', error);
      setDirectMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      toast({
        title: "Failed to send media",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  }, [currentUser, currentDirectChat, scrollToBottom, toast]);

  // Main lifecycle management with enhanced real-time setup
  useEffect(() => {
    if (currentUser) {
      setUserOnline();
      setupRealtimeSubscriptions();
      setupGlobalMessageSubscription();
      startHeartbeat();
      
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
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    }
  }, [currentUser, currentDirectChat, setupRealtimeSubscriptions, setupGlobalMessageSubscription, startHeartbeat, startMatching]);

  // Chat management
  useEffect(() => {
    if (currentUser && currentDirectChat) {
      loadDirectMessages();
      setupDirectMessageSubscription();
      setupPartnerStatusSubscription();
      
      localStorage.setItem('current_chat', JSON.stringify(currentDirectChat));
      if (currentChatPartner) {
        localStorage.setItem('chat_partner', JSON.stringify(currentChatPartner));
      }
    }
  }, [currentDirectChat, currentUser, setupDirectMessageSubscription, setupPartnerStatusSubscription]);

  useEffect(() => {
    scrollToBottom();
  }, [directMessages, scrollToBottom]);

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

  const setUserOnline = async () => {
    if (!currentUser) return;
    
    try {
      await supabase
        .from('casual_users')
        .update({ 
          status: currentDirectChat ? 'matched' : 'available',
          last_active: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  };

  const setUserOffline = async () => {
    if (!currentUser) return;
    
    try {
      await supabase
        .from('casual_users')
        .update({ 
          status: 'offline',
          last_active: new Date().toISOString()
        })
        .eq('id', currentUser.id);
      
      localStorage.removeItem('casual_user');
      localStorage.removeItem('current_chat');
      localStorage.removeItem('chat_partner');
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  };

  const skipToNextUser = async () => {
    if (!currentChatPartner || !currentUser) return;
    
    const partnerName = currentChatPartner.username;
    
    try {
      await Promise.all([
        supabase.from('casual_users').update({ status: 'available' }).eq('id', currentChatPartner.id),
        supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id)
      ]);
      
      setCurrentChatPartner(null);
      setCurrentDirectChat(null);
      setDirectMessages([]);
      
      localStorage.removeItem('current_chat');
      localStorage.removeItem('chat_partner');
      
      toast({
        title: "Finding new person",
        description: `Left chat with ${partnerName}. Looking for someone new...`,
      });
      
      startMatching();
    } catch (error) {
      console.error('Error skipping to next user:', error);
    }
  };

  // Enhanced message loading with real-time sync
  const loadDirectMessages = async () => {
    if (!currentDirectChat) return;
    
    try {
      // Load messages with real-time ordering
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('chat_id', currentDirectChat.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      
      console.log('Loaded direct messages:', data?.length || 0);
      setDirectMessages(data || []);
      
      // Scroll to bottom after loading
      setTimeout(() => scrollToBottom(), 100);
      
    } catch (error) {
      console.error('Error loading direct messages:', error);
    }
  };

  // Setup global message monitoring for better real-time performance
  const setupGlobalMessageSubscription = useCallback(() => {
    if (channelsRef.current.globalMessages) return;

    channelsRef.current.globalMessages = supabase
      .channel('global-messages-monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages'
        },
        (payload) => {
          if (isUnmountingRef.current) return;
          
          try {
            // Only process if it's for current chat
            if (currentDirectChat && payload.new?.chat_id === currentDirectChat.id) {
              const newMessage = payload.new as DirectMessage;
              
              if (payload.eventType === 'INSERT') {
                setDirectMessages(prev => {
                  if (prev.some(msg => msg.id === newMessage.id)) return prev;
                  
                  const updated = [...prev, newMessage].sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  );
                  
                  // Trigger scroll after state update
                  requestAnimationFrame(() => scrollToBottom());
                  
                  return updated;
                });
              }
            }
          } catch (error) {
            console.error('Error in global message subscription:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Global messages subscription:', status);
      });
  }, [currentDirectChat, scrollToBottom]);

  // Activity listeners
  const addActivityListeners = () => {
    const handleActivity = () => {
      if (currentUser && !isUnmountingRef.current) {
        supabase
          .from('casual_users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', currentUser.id)
          .then(null, console.error);
      }
    };

    const handleBeforeUnload = () => {
      if (currentUser) setUserOffline();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTimeout(() => {
          if (document.hidden && currentUser && !isUnmountingRef.current) {
            supabase
              .from('casual_users')
              .update({ 
                last_active: new Date().toISOString(),
                status: 'away'
              })
              .eq('id', currentUser.id)
              .then(null, console.error);
          }
        }, 10000);
      } else if (currentUser) {
        supabase
          .from('casual_users')
          .update({ 
            status: currentDirectChat ? 'matched' : 'available',
            last_active: new Date().toISOString()
          })
          .eq('id', currentUser.id)
          .then(null, console.error);
      }
    };

    const events = ['keypress', 'click', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

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

  const cleanupAllChannels = () => {
    Object.values(channelsRef.current).forEach(channel => {
      if (channel) supabase.removeChannel(channel);
    });
    
    channelsRef.current = {
      directMessages: null,
      partnerStatus: null,
      matching: null,
      globalMessages: null,
    };
  };

  // Connection status indicator
  const ConnectionStatus = () => {
    if (!isConnected) {
      return (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-3 py-2 rounded-lg text-sm">
          Reconnecting...
        </div>
      );
    }
    return null;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <ConnectionStatus />
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

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <div className="grid grid-cols-1 gap-2">
                <div>💬 Anonymous random chat</div>
                <div>🌍 Meet people worldwide</div>
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
      <ConnectionStatus />
      
      <div className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 flex justify-between items-center">
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
              <span className="font-medium text-sm sm:text-base max-w-24 sm:max-w-none truncate">
                {currentUser.username}
              </span>
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
        {currentDirectChat ? (
          <Card className="h-[calc(100vh-140px)] sm:h-[600px] flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-lg sm:text-xl truncate">
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
                  className="gap-2 ml-2"
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
                    className={`max-w-[75%] sm:max-w-[85%] px-3 py-2 rounded-lg break-words ${
                      message.sender_id === currentUser.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium truncate">
                        {message.sender_username}
                      </span>
                      <span className="text-xs opacity-70 whitespace-nowrap">
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
                  autoFocus
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
          <Card className="h-[calc(100vh-140px)] sm:h-[600px] flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-4">
              {isSearchingForMatch ? (
                <>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
                  <h3 className="text-xl font-semibold mb-3">Finding Someone...</h3>
                  <p className="text-muted-foreground mb-4">
                    We're connecting you with someone who's online right now. This usually takes just a few seconds!
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
                  </div>
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
      
      {/* Mobile status bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-2 sm:hidden">
        <div className="text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>
              {currentDirectChat ? `Chatting with ${currentChatPartner?.username}` : 
               isSearchingForMatch ? 'Finding someone...' : 'Anonymous chat'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
