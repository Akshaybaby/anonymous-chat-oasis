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
  const [onlineUsers, setOnlineUsers] = useState<CasualUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Realtime channels with improved refs
  const channelsRef = useRef({
    userPresence: null as any,
    directMessages: null as any,
    partnerStatus: null as any,
    matching: null as any,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  // Enhanced scroll to bottom with retry mechanism
  const scrollToBottom = useCallback(() => {
    const scrollWithRetry = (attempts = 3) => {
      if (attempts <= 0) return;
      
      try {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      } catch (error) {
        // Retry after a short delay
        setTimeout(() => scrollWithRetry(attempts - 1), 100);
      }
    };
    
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => scrollWithRetry());
  }, []);

  // Enhanced connection monitoring
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
      console.log('Connection lost, attempting to reconnect...');
      reconnectTimeoutRef.current = setTimeout(() => {
        handleReconnection();
      }, 3000);
      return;
    }

    console.log('Reconnected successfully');
    if (currentUser) {
      // Re-establish all subscriptions
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
      
      // Restore chat if exists
      if (savedChat && savedPartner) {
        setCurrentDirectChat(JSON.parse(savedChat));
        setCurrentChatPartner(JSON.parse(savedPartner));
      }
    }

    // Initial connection check
    checkConnection();
  }, [checkConnection]);

  // Enhanced heartbeat system
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

    // Initial update
    updatePresence();
    
    heartbeatIntervalRef.current = setInterval(updatePresence, 10000); // Every 10 seconds
  }, [currentUser, currentDirectChat, handleReconnection]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Enhanced matching system with better error handling
  const startMatching = useCallback(() => {
    if (matchingIntervalRef.current || currentDirectChat || !currentUser) return;
    
    setIsSearchingForMatch(true);
    
    const attemptMatch = async () => {
      if (currentDirectChat || !currentUser || isUnmountingRef.current) return;
      
      try {
        // Find available users with better filtering
        const { data: availableUsers, error } = await supabase
          .from('casual_users')
          .select('*')
          .eq('status', 'available')
          .neq('id', currentUser.id)
          .gte('last_active', new Date(Date.now() - 60 * 1000).toISOString()) // Active in last 1 minute
          .order('last_active', { ascending: false })
          .limit(5);
        
        if (error || !availableUsers || availableUsers.length === 0) {
          return;
        }
        
        // Pick the most recently active user for better matching
        const targetUser = availableUsers[0];
        
        // Atomic match operation with better error handling
        const { data: matchResult, error: matchError } = await supabase.rpc('atomic_match_users', {
          user1_id: currentUser.id,
          user2_id: targetUser.id
        });
        
        if (matchError || !matchResult) {
          console.log('Match attempt failed, retrying...');
          return;
        }
        
        // Create direct chat
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
          console.error('Error creating chat:', chatError);
          // Revert status changes
          await Promise.all([
            supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id),
            supabase.from('casual_users').update({ status: 'available' }).eq('id', targetUser.id)
          ]);
          return;
        }

        // Successfully matched
        setCurrentChatPartner(targetUser);
        setCurrentDirectChat(chatData);
        setDirectMessages([]);
        stopMatching();
        
        toast({
          title: "Connected!",
          description: `You're now chatting with ${targetUser.username}`,
        });
        
      } catch (error) {
        console.error('Error in matching:', error);
      }
    };

    // Try immediately, then every 2 seconds
    attemptMatch();
    matchingIntervalRef.current = setInterval(attemptMatch, 2000);
  }, [currentUser, currentDirectChat, toast]);

  const stopMatching = useCallback(() => {
    setIsSearchingForMatch(false);
    if (matchingIntervalRef.current) {
      clearInterval(matchingIntervalRef.current);
      matchingIntervalRef.current = null;
    }
  }, []);

  // Enhanced realtime subscriptions with better error handling
  const setupRealtimeSubscriptions = useCallback(async () => {
    if (!currentUser) return;

    // Clean up existing subscriptions first
    Object.values(channelsRef.current).forEach(channel => {
      if (channel) supabase.removeChannel(channel);
    });

    // User presence subscription
    channelsRef.current.userPresence = supabase
      .channel('user-presence', { config: { broadcast: { self: true } } })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'casual_users'
        },
        (payload) => {
          if (isUnmountingRef.current) return;
          
          try {
            if (payload.eventType === 'UPDATE') {
              handleUserStatusChange(payload.new as CasualUser, payload.old as CasualUser);
            } else if (payload.eventType === 'INSERT') {
              handleNewUser(payload.new as CasualUser);
            } else if (payload.eventType === 'DELETE') {
              handleUserLeft(payload.old as CasualUser);
            }
            
            updateOnlineUsersList();
          } catch (error) {
            console.error('Error handling user presence change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('User presence subscription:', status);
        if (status === 'SUBSCRIBED') {
          updateOnlineUsersList();
        }
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
            
            // Check if this chat involves current user
            if (currentUser && (newChat.user1_id === currentUser.id || newChat.user2_id === currentUser.id)) {
              const partnerId = newChat.user1_id === currentUser.id ? newChat.user2_id : newChat.user1_id;
              const partnerUsername = newChat.user1_id === currentUser.id ? newChat.user2_username : newChat.user1_username;
              
              // Find partner details
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
              }
            }
          } catch (error) {
            console.error('Error handling new chat:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Matching subscription:', status);
      });
  }, [currentUser, toast, stopMatching]);

  const setupDirectMessageSubscription = useCallback(() => {
    if (!currentDirectChat || channelsRef.current.directMessages) return;

    channelsRef.current.directMessages = supabase
      .channel(`direct-messages-${currentDirectChat.id}`, { 
        config: { broadcast: { self: false } } 
      })
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
            console.log('New direct message received:', newMessage);
            
            setDirectMessages(prev => {
              // Check for duplicates more efficiently
              if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
              }
              
              // Insert in correct chronological order
              const newMessages = [...prev, newMessage];
              return newMessages.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
            
            // Auto-scroll to new message
            setTimeout(scrollToBottom, 100);
          } catch (error) {
            console.error('Error handling new message:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Direct messages subscription:', status);
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
            console.log('Partner status change:', updatedPartner);
            
            if (updatedPartner.status === 'offline') {
              handlePartnerDisconnect(updatedPartner.username);
            } else {
              // Update partner info
              setCurrentChatPartner(updatedPartner);
            }
          } catch (error) {
            console.error('Error handling partner status change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Partner status subscription:', status);
      });
  }, [currentChatPartner]);

  // Event handlers with improved error handling
  const handleUserStatusChange = useCallback((newUser: CasualUser, oldUser: CasualUser) => {
    // If our partner went offline
    if (currentChatPartner && newUser.id === currentChatPartner.id && newUser.status === 'offline') {
      handlePartnerDisconnect(newUser.username);
      return;
    }
    
    // Update online users list
    setOnlineUsers(prev => {
      const filtered = prev.filter(u => u.id !== newUser.id);
      if (newUser.status === 'available' || newUser.status === 'matched') {
        return [...filtered, newUser].sort((a, b) => 
          new Date(b.last_active || '').getTime() - new Date(a.last_active || '').getTime()
        );
      }
      return filtered;
    });
  }, [currentChatPartner]);

  const handleNewUser = useCallback((newUser: CasualUser) => {
    if (newUser.status === 'available' || newUser.status === 'matched') {
      setOnlineUsers(prev => {
        if (prev.some(u => u.id === newUser.id)) return prev;
        return [newUser, ...prev].sort((a, b) => 
          new Date(b.last_active || '').getTime() - new Date(a.last_active || '').getTime()
        );
      });
    }
  }, []);

  const handleUserLeft = useCallback((user: CasualUser) => {
    setOnlineUsers(prev => prev.filter(u => u.id !== user.id));
    
    if (currentChatPartner && user.id === currentChatPartner.id) {
      handlePartnerDisconnect(user.username);
    }
  }, [currentChatPartner]);

  const handlePartnerDisconnect = useCallback(async (partnerName: string) => {
    console.log('Partner disconnected:', partnerName);
    
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    
    // Clear localStorage
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    
    // Update status back to available
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
    
    // Start matching again
    setTimeout(() => startMatching(), 1000);
  }, [currentUser, toast, startMatching]);

  const updateOnlineUsersList = useCallback(async () => {
    try {
      const { data: users, error } = await supabase
        .from('casual_users')
        .select('*')
        .in('status', ['available', 'matched'])
        .gte('last_active', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_active', { ascending: false })
        .limit(20);
      
      if (!error && users) {
        setOnlineUsers(users);
      }
    } catch (error) {
      console.error('Error updating online users:', error);
    }
  }, []);

  // Enhanced message sending with optimistic updates
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUser || !currentDirectChat) return;

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMessage: DirectMessage = {
      id: tempId,
      content: messageContent,
      sender_username: currentUser.username,
      sender_id: currentUser.id,
      created_at: new Date().toISOString(),
      message_type: 'text'
    };

    // Optimistic update
    setDirectMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: currentDirectChat.id,
          sender_id: currentUser.id,
          sender_username: currentUser.username,
          content: messageContent
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real message
      setDirectMessages(prev => 
        prev.map(msg => msg.id === tempId ? data : msg)
      );

      // Update last_message_at
      await supabase
        .from('direct_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', currentDirectChat.id);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove temp message and restore input
      setDirectMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageContent);
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  }, [newMessage, currentUser, currentDirectChat, scrollToBottom, toast]);

  // Enhanced media message sending
  const sendMediaMessage = useCallback(async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser || !currentDirectChat) return;

    const tempId = `temp-media-${Date.now()}`;
    const tempMessage: DirectMessage = {
      id: tempId,
      content: '',
      sender_username: currentUser.username,
      sender_id: currentUser.id,
      created_at: new Date().toISOString(),
      message_type: mediaType,
      media_url: mediaUrl
    };

    // Optimistic update
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

      // Replace temp message with real message
      setDirectMessages(prev => 
        prev.map(msg => msg.id === tempId ? data : msg)
      );

      await supabase
        .from('direct_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', currentDirectChat.id);

    } catch (error) {
      console.error('Error sending media message:', error);
      
      // Remove temp message
      setDirectMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      toast({
        title: "Error",
        description: "Failed to send media. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentUser, currentDirectChat, scrollToBottom, toast]);

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
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    }
  }, [currentUser, currentDirectChat, setupRealtimeSubscriptions, startHeartbeat, startMatching]);

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
  }, [currentDirectChat, currentUser, setupDirectMessageSubscription, setupPartnerStatusSubscription]);

  // Auto-scroll messages
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
      
      // Clear localStorage
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
      // Set both users back to available
      await Promise.all([
        supabase.from('casual_users').update({ status: 'available' }).eq('id', currentChatPartner.id),
        supabase.from('casual_users').update({ status: 'available' }).eq('id', currentUser.id)
      ]);
      
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
    } catch (error) {
      console.error('Error skipping to next user:', error);
    }
  };

  const loadDirectMessages = async () => {
    if (!currentDirectChat) return;
    
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('chat_id', currentDirectChat.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      
      setDirectMessages(data || []);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading direct messages:', error);
    }
  };

  // Activity listeners for detecting user presence
  const addActivityListeners = () => {
    const handleActivity = () => {
      if (currentUser && !isUnmountingRef.current) {
        supabase
          .from('casual_users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', currentUser.id)
          .then(null, (error) => console.error('Activity update failed:', error));
      }
    };

    const handleBeforeUnload = () => {
      if (currentUser) {
        setUserOffline();
      }
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
              .then(null, (error) => console.error('Away status update failed:', error));
          }
        }, 30000);
      } else if (currentUser) {
        supabase
          .from('casual_users')
          .update({ 
            status: currentDirectChat ? 'matched' : 'available',
            last_active: new Date().toISOString()
          })
          .eq('id', currentUser.id)
          .then(null, (error) => console.error('Active status update failed:', error));
      }
    };

    const events = ['mousedown', 'keypress', 'touchstart', 'scroll', 'mousemove', 'click'];
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
      if (channel) {
        supabase.removeChannel(channel);
      }
    });
    
    // Reset all channels
    channelsRef.current = {
      userPresence: null,
      directMessages: null,
      partnerStatus: null,
      matching: null,
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ConnectionStatus />
      
      <div className="border-b bg-card sticky top-0 z-40">
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
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm font-medium">
                        {onlineUsers.length} online now
                      </span>
                    </div>
                  </div>

                  {isSearchingForMatch && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Finding someone...</p>
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
                          <p className="text-lg font-semibold text-primary truncate">
                            {currentChatPartner.username}
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={skipToNextUser}
                        variant="outline"
                        className="w-full gap-2 text-sm"
                        size="sm"
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
                  {onlineUsers.slice(0, 15).map((user) => (
                    <div key={user.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <div 
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: user.avatar_color }}
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {user.username}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${
                        user.status === 'available' ? 'bg-green-500' : 
                        user.status === 'matched' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}></div>
                    </div>
                  ))}
                  {onlineUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Loading users...
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
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-lg sm:text-xl truncate">
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
                      className="gap-2 ml-2"
                    >
                      <SkipForward className="w-3 h-3" />
                      <span className="hidden sm:inline">Next</span>
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollBehavior: 'smooth' }}>
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
                        className={`max-w-[70%] sm:max-w-[80%] px-3 py-2 rounded-lg break-words ${
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
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1"
                      disabled={!currentDirectChat}
                      maxLength={1000}
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
                <div className="text-center max-w-md mx-auto p-4">
                  <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {isSearchingForMatch ? 'Finding Someone...' : 'No Active Chat'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
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
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{onlineUsers.length} people online • Anonymous chat</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
