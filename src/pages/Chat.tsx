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
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [selectedDirectChat, setSelectedDirectChat] = useState<DirectChat | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<RoomParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [activeTab, setActiveTab] = useState('direct');
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);
  const [randomMatch, setRandomMatch] = useState<CasualUser | null>(null);
  const [reconnectTimeout, setReconnectTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  useEffect(() => {
    loadRooms();
    loadAllUsers();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadDirectChats();
      if (activeTab === 'rooms' && selectedRoom) {
        loadMessages();
        loadParticipants();
        joinRoom();
        subscribeToMessages();
        subscribeToParticipants();
      } else if (activeTab === 'direct' && selectedDirectChat) {
        loadDirectMessages();
        subscribeToDirectMessages();
      }
    }
  }, [selectedRoom, selectedDirectChat, currentUser, activeTab]);

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

  const loadAllUsers = async () => {
    const { data, error } = await supabase
      .from('casual_users')
      .select('*')
      .order('last_active', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error loading users:', error);
      return;
    }
    
    setOnlineUsers(data?.map(user => ({
      id: user.id,
      username: user.username,
      user_id: user.id
    })) || []);
  };

  const loadDirectChats = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('direct_chats')
      .select('*')
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error loading direct chats:', error);
      return;
    }

    setDirectChats(data || []);
  };

  const loadDirectMessages = async () => {
    if (!selectedDirectChat) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', selectedDirectChat.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading direct messages:', error);
      return;
    }

    setDirectMessages(data || []);
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
    toast({
      title: "Welcome to StrangerChat!",
      description: `You joined as ${username}`,
    });
  };

  const startDirectChat = async (targetUser: RoomParticipant) => {
    if (!currentUser) return;

    // Check if chat already exists
    const existingChat = directChats.find(chat => 
      (chat.user1_id === currentUser.id && chat.user2_id === targetUser.user_id) ||
      (chat.user1_id === targetUser.user_id && chat.user2_id === currentUser.id)
    );

    if (existingChat) {
      setSelectedDirectChat(existingChat);
      setActiveTab('direct');
      return;
    }

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

    setDirectChats(prev => [data, ...prev]);
    setSelectedDirectChat(data);
    setActiveTab('direct');
    toast({
      title: "Chat started",
      description: `Started conversation with ${targetUser.username}`,
    });
  };

  const loadMessages = async () => {
    if (!selectedRoom) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', selectedRoom.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(data || []);
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

    if (activeTab === 'direct' && selectedDirectChat) {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: selectedDirectChat.id,
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
        .eq('id', selectedDirectChat.id);
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

    if (activeTab === 'direct' && selectedDirectChat) {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          chat_id: selectedDirectChat.id,
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
        .eq('id', selectedDirectChat.id);
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
    if (!selectedDirectChat) return;

    const channel = supabase
      .channel(`direct-chat-${selectedDirectChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_id=eq.${selectedDirectChat.id}`
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

  const getOtherUserInDirectChat = (chat: DirectChat) => {
    if (!currentUser) return '';
    return chat.user1_id === currentUser.id ? chat.user2_username : chat.user1_username;
  };

  // Random user connection functions
  const findRandomUser = async () => {
    if (!currentUser) return;
    
    setIsSearchingForMatch(true);
    
    // Clear any existing timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      setReconnectTimeout(null);
    }
    
    // Get available users (excluding current user)
    const { data: availableUsers, error } = await supabase
      .from('casual_users')
      .select('*')
      .neq('id', currentUser.id)
      .order('last_active', { ascending: false })
      .limit(100);
    
    if (error || !availableUsers || availableUsers.length === 0) {
      setIsSearchingForMatch(false);
      toast({
        title: "No users available",
        description: "There are no other users online right now. Please try again later.",
      });
      return;
    }
    
    // Pick a random user
    const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
    setRandomMatch(randomUser);
    setIsSearchingForMatch(false);
    
    // Create or find existing direct chat
    await startRandomDirectChat(randomUser);
    
    toast({
      title: "Connected!",
      description: `You're now chatting with ${randomUser.username}`,
    });
  };

  const startRandomDirectChat = async (targetUser: CasualUser) => {
    if (!currentUser) return;

    // Check if chat already exists
    const existingChat = directChats.find(chat => 
      (chat.user1_id === currentUser.id && chat.user2_id === targetUser.id) ||
      (chat.user1_id === targetUser.id && chat.user2_id === currentUser.id)
    );

    if (existingChat) {
      setSelectedDirectChat(existingChat);
      setActiveTab('direct');
      return;
    }

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

    setDirectChats(prev => [data, ...prev]);
    setSelectedDirectChat(data);
    setActiveTab('direct');
  };

  const leaveRandomChat = () => {
    setSelectedDirectChat(null);
    setRandomMatch(null);
    
    // Set timeout to find new user after 10 seconds
    const timeout = setTimeout(() => {
      findRandomUser();
    }, 10000);
    
    setReconnectTimeout(timeout);
    
    toast({
      title: "Chat ended",
      description: "Looking for a new person to chat with in 10 seconds...",
    });
  };

  const skipToNextUser = () => {
    leaveRandomChat();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-8">
              <div className="text-center mb-8">
                <div className="mb-6">
                  <h1 className="text-5xl font-bold tracking-tight mb-2">
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
                <p className="text-muted-foreground text-lg">
                  Start private conversations or join group chat rooms. Connect instantly with strangers worldwide!
                </p>
              </div>
              
              <div className="space-y-4 max-w-md mx-auto">
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

          <div className="space-y-4">
            <Card className="p-6 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20">
              <div className="text-center">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">Advertisement</h3>
                <div className="mt-4 p-8 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm text-orange-700 dark:text-orange-300">Your Ad Here</p>
                  <p className="text-xs mt-2 text-orange-600 dark:text-orange-400">300x250 Banner</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Stranger
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
                Chat
              </span>
            </h1>
          </div>
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

      <div className="max-w-7xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
            <TabsTrigger value="direct" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Private Chats
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-2">
              <Users className="w-4 h-4" />
              Chat Rooms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Random Chat Controls */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Random Chat</h3>
                  <div className="space-y-3">
                    {!selectedDirectChat && !isSearchingForMatch && (
                      <Button 
                        onClick={findRandomUser}
                        variant="light-blue"
                        className="w-full gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Connect to Random User
                      </Button>
                    )}
                    
                    {isSearchingForMatch && (
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                        <p className="text-sm text-muted-foreground">Finding someone to chat with...</p>
                      </div>
                    )}
                    
                    {selectedDirectChat && randomMatch && (
                      <div className="space-y-2">
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
                    
                    {reconnectTimeout && (
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Finding new person in 10 seconds...
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Previous Conversations</h3>
                  <div className="space-y-2">
                    {directChats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedDirectChat(chat)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedDirectChat?.id === chat.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium">{getOtherUserInDirectChat(chat)}</div>
                        <div className="text-xs opacity-70">
                          {new Date(chat.last_message_at).toLocaleString()}
                        </div>
                      </button>
                    ))}
                    {directChats.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No previous conversations
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Direct Chat Area */}
            <div className="lg:col-span-3">
              {selectedDirectChat ? (
                <Card className="h-[600px] flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold">{getOtherUserInDirectChat(selectedDirectChat)}</h2>
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
                <Card className="h-[600px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Random Anonymous Chat</h3>
                    <p className="mb-4">Connect with random strangers worldwide</p>
                    <Button 
                      onClick={findRandomUser}
                      variant="light-blue"
                      disabled={isSearchingForMatch}
                      className="gap-2"
                    >
                      {isSearchingForMatch ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Finding someone...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4" />
                          Start Random Chat
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
            <div className="lg:col-span-2">
              {selectedRoom ? (
                <Card className="h-[600px] flex flex-col">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">{selectedRoom?.name}</h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {participants.length} online
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedRoom?.description}</p>
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
                <Card className="h-[600px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Select a chat room</h3>
                    <p>Choose a room to join the conversation</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Room Participants */}
            <div className="lg:col-span-1">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Online ({participants.length})
                  </h3>
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ backgroundColor: avatarColors[participant.username.charCodeAt(0) % avatarColors.length] }}
                          >
                            {participant.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{participant.username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-muted-foreground">online</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Chat;