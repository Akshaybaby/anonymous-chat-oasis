import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Users, MessageCircle, Home } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom && currentUser) {
      loadMessages();
      loadParticipants();
      joinRoom();
      subscribeToMessages();
      subscribeToParticipants();
    }
  }, [selectedRoom, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    if (data && data.length > 0) {
      setSelectedRoom(data[0]);
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
    if (!newMessage.trim() || !selectedRoom || !currentUser) return;

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

    setNewMessage('');
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Login Card */}
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
                  Connect with strangers from around the world. No registration required!
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
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                  size="lg"
                >
                  {isJoining ? 'Joining...' : 'Start Chatting'}
                </Button>
              </div>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>🌍 Talk worldwide</div>
                  <div>💬 Share experiences</div>
                  <div>🎉 Make friends</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Advertisement Space */}
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

            <Card className="p-6 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20">
              <div className="text-center">
                <h3 className="font-semibold text-green-800 dark:text-green-200">Sponsored</h3>
                <div className="mt-4 p-8 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">Sponsor Content</p>
                  <p className="text-xs mt-2 text-green-600 dark:text-green-400">300x250 Banner</p>
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
      {/* Header */}
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

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Room List */}
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

          {/* Ad Space */}
          <Card className="mt-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">Advertisement</h4>
                <div className="mt-3 p-6 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">Your Ad Here</p>
                  <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">250x200</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {/* Chat Header */}
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

            {/* Messages */}
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
                    <p className="text-sm mt-1">{message.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
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
        </div>

        {/* Right Sidebar - Users & Ads */}
        <div className="lg:col-span-1 space-y-4">
          {/* Online Users */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Online ({participants.length})
              </h3>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ backgroundColor: avatarColors[participant.username.charCodeAt(0) % avatarColors.length] }}
                    >
                      {participant.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{participant.username}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ad Spaces */}
          <Card className="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200">Sponsored</h4>
                <div className="mt-3 p-6 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-300">Ad Space</p>
                  <p className="text-xs mt-1 text-purple-600 dark:text-purple-400">250x150</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-800/20">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="font-semibold text-red-800 dark:text-red-200">Advertisement</h4>
                <div className="mt-3 p-6 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">Banner Ad</p>
                  <p className="text-xs mt-1 text-red-600 dark:text-red-400">250x150</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/20 dark:to-yellow-800/20">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Promoted</h4>
                <div className="mt-3 p-6 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Content Ad</p>
                  <p className="text-xs mt-1 text-yellow-600 dark:text-yellow-400">250x150</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Chat;