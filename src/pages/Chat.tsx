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

// -------------------------
// Types
// -------------------------
interface CasualUser {
  id: string;
  username: string;
  avatar_color: string;
  status: string;
  last_active?: string;
  is_bot?: boolean;
  session_id?: string;
  session_revoked?: boolean;
}

interface DirectChat {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_username: string;
  user2_username: string;
  last_message_at: string;
}

interface DirectMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_username: string;
  content: string | null;
  message_type: string;
  media_url?: string | null;
  created_at: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_username: string;
  content: string | null;
  message_type: string;
  media_url?: string | null;
  created_at: string;
}

// -------------------------
// Helpers
// -------------------------
const BOT_NAMES = [
  'Rahul','Sneha','Arjun','Mariya','Fathima',
  'Anna','Caroline','Safiya','Jeni','Jennifer','Nicole'
];

const avatarColors = [
  'bg-red-500','bg-blue-500','bg-green-500','bg-yellow-500',
  'bg-purple-500','bg-pink-500','bg-indigo-500','bg-teal-500'
];

const randomDelay = (min=700, max=1800) =>
  Math.floor(min + Math.random()*(max-min));

const botReply = (humanMsg: string) => {
  const starters = [
    'Interesting! ','Got it. ','Makes sense. ',
    'Haha, true. ','I see. ','Tell me more— '
  ];
  const followups = [
    'what do you think?','how did that happen?',
    'have you tried anything else?','why do you feel that way?',
    "that's pretty cool.",'I\'m curious now.'
  ];
  const echo = humanMsg ? humanMsg.slice(0, 120) : '';
  return `${starters[Math.floor(Math.random()*starters.length)]}${echo ? `"${echo}" — ` : ''}${followups[Math.floor(Math.random()*followups.length)]}`;
};

// -------------------------
// Component
// -------------------------
export default function Chat() {
  const [username, setUsername] = useState('');
  const [currentUser, setCurrentUser] = useState<CasualUser | null>(null);
  const [currentChatPartner, setCurrentChatPartner] = useState<CasualUser | null>(null);
  const [currentDirectChat, setCurrentDirectChat] = useState<DirectChat | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);

  // Group chat state
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupInput, setGroupInput] = useState('');

  const messageChannelRef = useRef<any>(null);
  const partnerPresenceChannelRef = useRef<any>(null);
  const botTimerRef = useRef<NodeJS.Timeout | null>(null);

  const groupChannelRef = useRef<any>(null);
  const { toast } = useToast();

  // -------------------------
  // Ensure bots exist
  // -------------------------
  const ensureBotsExist = useCallback(async () => {
    const { data: existing } = await supabase
      .from('casual_users')
      .select('username')
      .in('username', BOT_NAMES);

    const existingSet = new Set((existing || []).map((r: any) => r.username));
    const toCreate = BOT_NAMES.filter(n => !existingSet.has(n));

    if (toCreate.length) {
      const rows = toCreate.map(n => ({
        username: n,
        avatar_color: avatarColors[Math.floor(Math.random()*avatarColors.length)],
        status: 'available',
        is_bot: true,
        last_active: new Date().toISOString()
      }));
      await supabase.from('casual_users').insert(rows);
    }
  }, []);

  // -------------------------
  // Create user (session isolated)
  // -------------------------
  const createUser = async () => {
    if (!username.trim()) {
      toast({
        title: 'Username required',
        description: 'Please enter a username to start chatting',
        variant: 'destructive'
      });
      return;
    }
    setIsJoining(true);
    const avatarColor = avatarColors[Math.floor(Math.random()*avatarColors.length)];
    const sessionId = crypto.randomUUID();

    try {
      const { data, error } = await supabase
        .from('casual_users')
        .insert({
          username: username.trim(),
          avatar_color: avatarColor,
          status: 'available',
          last_active: new Date().toISOString(),
          is_bot: false,
          session_id: sessionId,
          session_revoked: false
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentUser(data);
      localStorage.setItem('casual_user', JSON.stringify(data));

      await ensureBotsExist();

      // revoke session on unload
      const revoke = async () => {
        if (data?.id) {
          await supabase.rpc('leave_chat', { p_user_id: data.id }).catch(()=>{});
          await supabase.from('casual_users')
            .update({ status: 'available', session_revoked: true })
            .eq('id', data.id);
        }
      };
      window.addEventListener('beforeunload', revoke);
    } catch (e) {
      console.error('Error creating user:', e);
      toast({ title: 'Error', description: 'Failed to create user', variant: 'destructive' });
    } finally {
      setIsJoining(false);
    }
  };

  // -------------------------
  // Matchmaking (human-first, then bots)
  // -------------------------
  const findMatch = useCallback(async () => {
    if (!currentUser || currentDirectChat) return;

    try {
      // 1) Try real users
      const { data: humans } = await supabase
        .from('casual_users')
        .select('*')
        .eq('status','available')
        .eq('is_bot', false)
        .neq('id', currentUser.id)
        .gte('last_active', new Date(Date.now() - 60000).toISOString())
        .order('last_active',{ ascending:false })
        .limit(5);

      let targetUser: CasualUser | null = null;
      if (humans && humans.length) {
        targetUser = humans[0];
      } else {
        // 2) Fallback to bots
        const { data: bots } = await supabase
          .from('casual_users')
          .select('*')
          .eq('status','available')
          .eq('is_bot', true)
          .order('last_active',{ ascending:false })
          .limit(1);
        if (bots && bots.length) {
          targetUser = bots[0];
        }
      }

      if (targetUser) {
        // atomic_match_users RPC should set both users to matched (implement server-side)
        await supabase.rpc('atomic_match_users', {
          user1_id: currentUser.id,
          user2_id: targetUser.id
        });

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

          toast({ title: 'Connected!', description: `You're now chatting with ${targetUser.username}` });
        }
      }
    } catch (error) {
      console.error('Error finding match:', error);
    }
  }, [currentUser, currentDirectChat, toast]);

  const startMatching = useCallback(() => {
    setIsSearchingForMatch(true);
    findMatch();
    const interval = setInterval(findMatch, 5000);
    return () => clearInterval(interval);
  }, [findMatch]);

  // -------------------------
  // Partner presence watch (auto-disconnect + re-match)
  // -------------------------
  const watchPartnerPresence = useCallback(() => {
    if (!currentChatPartner) return;
    if (partnerPresenceChannelRef.current) return;

    partnerPresenceChannelRef.current = supabase
      .channel(`presence-${currentChatPartner.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'casual_users',
        filter: `id=eq.${currentChatPartner.id}`
      }, (payload) => {
        const row = payload.new as CasualUser;
        if (row.status !== 'matched' || row.session_revoked) {
          // partner left or revoked session -> disconnect and re-match
          setCurrentChatPartner(null);
          setCurrentDirectChat(null);
          setDirectMessages([]);
          localStorage.removeItem('current_chat');
          localStorage.removeItem('chat_partner');
          toast({ title: 'Partner left', description: 'Finding a new match...' });
          startMatching();
          if (partnerPresenceChannelRef.current) {
            supabase.removeChannel(partnerPresenceChannelRef.current);
            partnerPresenceChannelRef.current = null;
          }
        }
      })
      .subscribe();
  }, [currentChatPartner, startMatching, toast]);

  // -------------------------
  // Load direct messages
  // -------------------------
  const loadMessages = useCallback(async () => {
    if (!currentDirectChat) return;
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', currentDirectChat.id)
      .order('created_at', { ascending:true });
    if (!error && data) setDirectMessages(data);
  }, [currentDirectChat]);

  // -------------------------
  // Setup direct message subscription (and bot reply for direct)
  // -------------------------
  const setupMessageSubscription = useCallback(() => {
    if (!currentDirectChat) return;
    if (messageChannelRef.current) return;

    messageChannelRef.current = supabase
      .channel(`chat-${currentDirectChat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `chat_id=eq.${currentDirectChat.id}`
      }, (payload) => {
        const newMessage = payload.new as DirectMessage;
        setDirectMessages(prev => [...prev, newMessage]);

        // If chatting with a bot, auto-reply when human sends message
        if (currentChatPartner?.is_bot && newMessage.sender_id === currentUser?.id) {
          if (botTimerRef.current) clearTimeout(botTimerRef.current);
          botTimerRef.current = setTimeout(async () => {
            try {
              await supabase.from('direct_messages').insert({
                chat_id: currentDirectChat.id,
                sender_id: currentChatPartner.id,
                sender_username: currentChatPartner.username,
                content: botReply(newMessage.content || ''),
                message_type: 'text'
              });
              // update bot last_active
              await supabase.from('casual_users').update({
                last_active: new Date().toISOString(),
                status: 'matched'
              }).eq('id', currentChatPartner.id);
            } catch (e) {
              console.error('bot reply failed', e);
            }
          }, randomDelay());
        }
      })
      .subscribe();
  }, [currentDirectChat, currentChatPartner, currentUser]);

  // -------------------------
  // Load group messages
  // -------------------------
  const loadGroupMessages = useCallback(async (groupId: string) => {
    const { data, error } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (!error && data) setGroupMessages(data);
  }, []);

  // -------------------------
  // Setup group subscription + bot fallback
  // -------------------------
  const setupGroupSubscription = useCallback((groupId: string) => {
    if (!groupId) return;
    if (groupChannelRef.current) return;

    groupChannelRef.current = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`
      }, async (payload) => {
        const newMsg = payload.new as GroupMessage;
        setGroupMessages(prev => [...prev, newMsg]);

        // If the sender is a real user, check if other real users are active in the group
        if (!newMsg.sender_id) return;

        try {
          // Attempt 1: check group_members table for other members who are real and "active"
          // (Assumes you have group_members: { group_id, user_id })
          const { data: members } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);

          let otherRealActiveCount = 0;

          if (members && members.length) {
            const memberIds = (members as any[]).map(m => m.user_id).filter((id: string) => id !== newMsg.sender_id);
            if (memberIds.length) {
              const { data: activeUsers } = await supabase
                .from('casual_users')
                .select('id')
                .in('id', memberIds)
                .eq('is_bot', false)
                .gte('last_active', new Date(Date.now() - 60000).toISOString()); // active within last 60s

              otherRealActiveCount = (activeUsers && activeUsers.length) ? activeUsers.length : 0;
            } else {
              otherRealActiveCount = 0;
            }
          } else {
            // Fallback: check casual_users excluding sender (if no group_members table)
            const { data: otherHumans } = await supabase
              .from('casual_users')
              .select('id')
              .neq('id', newMsg.sender_id)
              .eq('is_bot', false)
              .gte('last_active', new Date(Date.now() - 60000).toISOString())
              .limit(5);

            otherRealActiveCount = (otherHumans && otherHumans.length) ? otherHumans.length : 0;
          }

          // If there are no other *real* active users, spawn one or more bots to reply in the group
          if (otherRealActiveCount === 0) {
            // pick 1-2 bots to reply
            const { data: bots } = await supabase
              .from('casual_users')
              .select('*')
              .eq('is_bot', true)
              .order('last_active', { ascending: false })
              .limit(2);

            const botsToUse = (bots && bots.length) ? bots : [];

            botsToUse.forEach((bot: any, idx: number) => {
              setTimeout(async () => {
                try {
                  await supabase.from('group_messages').insert({
                    group_id: groupId,
                    sender_id: bot.id,
                    sender_username: bot.username,
                    content: botReply(newMsg.content || ''),
                    message_type: 'text'
                  });
                  // update bot last_active
                  await supabase.from('casual_users').update({
                    last_active: new Date().toISOString()
                  }).eq('id', bot.id);
                } catch (e) {
                  console.error('group bot reply failed', e);
                }
              }, randomDelay(900 + idx*400, 2000 + idx*500));
            });
          }
        } catch (e) {
          // If anything fails, we still want the system to be resilient. Try a simple fallback:
          try {
            const { data: bots } = await supabase
              .from('casual_users')
              .select('*')
              .eq('is_bot', true)
              .limit(1);
            if (bots && bots.length) {
              const bot = bots[0];
              setTimeout(async () => {
                try {
                  await supabase.from('group_messages').insert({
                    group_id: groupId,
                    sender_id: bot.id,
                    sender_username: bot.username,
                    content: botReply(newMsg.content || ''),
                    message_type: 'text'
                  });
                } catch (e2) { console.error('fallback group bot failed', e2); }
              }, randomDelay());
            }
          } catch (inner) {
            console.error('group fallback failed', inner);
          }
        }
      })
      .subscribe();
  }, []);

  // -------------------------
  // Effects
  // -------------------------
  useEffect(() => {
    const saved = localStorage.getItem('casual_user');
    if (!saved) return;
    const user = JSON.parse(saved) as CasualUser;
    supabase.from('casual_users').select('id, session_revoked')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (!data || data.session_revoked) {
          localStorage.removeItem('casual_user');
          localStorage.removeItem('current_chat');
          localStorage.removeItem('chat_partner');
          setCurrentUser(null);
        } else {
          setCurrentUser(user);
        }
      }).catch((e)=>{ console.error(e); });
  }, []);

  useEffect(() => {
    if (currentDirectChat) {
      loadMessages();
      setupMessageSubscription();
      watchPartnerPresence();
      return () => {
        if (messageChannelRef.current) {
          supabase.removeChannel(messageChannelRef.current);
          messageChannelRef.current = null;
        }
        if (partnerPresenceChannelRef.current) {
          supabase.removeChannel(partnerPresenceChannelRef.current);
          partnerPresenceChannelRef.current = null;
        }
        if (botTimerRef.current) {
          clearTimeout(botTimerRef.current);
          botTimerRef.current = null;
        }
      };
    }
  }, [currentDirectChat, loadMessages, setupMessageSubscription, watchPartnerPresence]);

  // group subscription effect
  useEffect(() => {
    if (currentGroupId) {
      loadGroupMessages(currentGroupId);
      setupGroupSubscription(currentGroupId);
      return () => {
        if (groupChannelRef.current) {
          supabase.removeChannel(groupChannelRef.current);
          groupChannelRef.current = null;
        }
      };
    }
  }, [currentGroupId, loadGroupMessages, setupGroupSubscription]);

  // -------------------------
  // Send direct message
  // -------------------------
  const sendMessage = async () => {
    if (!messageInput.trim() || !currentUser || !currentDirectChat) return;
    await supabase.from('direct_messages').insert({
      chat_id: currentDirectChat.id,
      sender_id: currentUser.id,
      sender_username: currentUser.username,
      content: messageInput,
      message_type: 'text'
    });
    setMessageInput('');
  };

  // -------------------------
  // Send group message
  // -------------------------
  const sendGroupMessage = async () => {
    if (!groupInput.trim() || !currentUser || !currentGroupId) return;
    await supabase.from('group_messages').insert({
      group_id: currentGroupId,
      sender_id: currentUser.id,
      sender_username: currentUser.username,
      content: groupInput,
      message_type: 'text'
    });
    setGroupInput('');
  };

  // -------------------------
  // Skip to next user
  // -------------------------
  const skipToNextUser = async () => {
    if (!currentChatPartner || !currentUser) return;
    const partnerName = currentChatPartner.username;
    await Promise.all([
      supabase.from('casual_users').update({ status:'available' }).eq('id', currentChatPartner.id),
      supabase.from('casual_users').update({ status:'available' }).eq('id', currentUser.id)
    ]);
    if (partnerPresenceChannelRef.current) {
      supabase.removeChannel(partnerPresenceChannelRef.current);
      partnerPresenceChannelRef.current = null;
    }
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    setCurrentChatPartner(null);
    setCurrentDirectChat(null);
    setDirectMessages([]);
    localStorage.removeItem('current_chat');
    localStorage.removeItem('chat_partner');
    toast({ title: 'Finding new person', description: `Left chat with ${partnerName}. Looking for someone new...` });
    startMatching();
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center space-x-4">
          <Link to="/"><Home className="w-5 h-5"/></Link>
          <span className="font-bold">Anonymous Chat Oasis</span>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          {currentUser ? <span className="text-sm">Signed in as {currentUser.username}</span> : null}
        </div>
      </div>

      {!currentUser ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Input
            placeholder="Enter a username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={createUser} disabled={isJoining} className="mt-2">
            {isJoining ? 'Joining...' : 'Join Chat'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-1">
          {/* Left: Direct Chat */}
          <div className="w-2/3 border-r p-2 flex flex-col">
            {currentChatPartner ? (
              <>
                <div className="flex items-center p-2 border-b">
                  <span className="font-bold">{currentChatPartner.username}</span>
                  <Button onClick={skipToNextUser} className="ml-auto" size="sm" variant="outline">
                    <SkipForward className="w-4 h-4 mr-1"/> Skip
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {directMessages.map((m) => (
                    <MessageRenderer key={m.id} message={m} currentUser={currentUser} />
                  ))}
                </div>
                <div className="flex items-center p-2 border-t">
                  <MediaUpload onMediaUploaded={async (url, type) => {
                    if (!currentUser || !currentDirectChat) return;
                    await supabase.from('direct_messages').insert({
                      chat_id: currentDirectChat.id,
                      sender_id: currentUser.id,
                      sender_username: currentUser.username,
                      content: type === 'image' ? '[image]' : type === 'video' ? '[video]' : '[file]',
                      message_type: type,
                      media_url: url
                    });
                  }} />
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 ml-2"
                  />
                  <Button onClick={sendMessage} className="ml-2"><Send className="w-4 h-4"/></Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                {isSearchingForMatch ? (
                  <p>Searching for a match...</p>
                ) : (
                  <Button onClick={startMatching}><MessageCircle className="w-4 h-4 mr-1"/> Start Chatting</Button>
                )}
              </div>
            )}
          </div>

          {/* Right: Group Chat (minimal UI for testing + messages) */}
          <div className="w-1/3 p-2 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Group Chat</span>
              {/* Minimal quick-join for testing */}
              <Button onClick={() => {
                // toggle demo group id "demo-group"
                setCurrentGroupId(prev => prev ? null : 'demo-group');
              }} size="sm" variant="ghost">
                {currentGroupId ? 'Leave Group' : 'Join Demo Group'}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border p-2 rounded">
              {groupMessages.length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages in group.</div>
              ) : groupMessages.map((gm) => (
                <MessageRenderer key={gm.id} message={gm as any} currentUser={currentUser} />
              ))}
            </div>

            {currentGroupId ? (
              <div className="mt-2 flex items-center">
                <MediaUpload onMediaUploaded={async (url, type) => {
                  if (!currentUser || !currentGroupId) return;
                  await supabase.from('group_messages').insert({
                    group_id: currentGroupId,
                    sender_id: currentUser.id,
                    sender_username: currentUser.username,
                    content: type === 'image' ? '[image]' : type === 'video' ? '[video]' : '[file]',
                    message_type: type,
                    media_url: url
                  });
                }} />
                <Input
                  placeholder="Message group..."
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendGroupMessage()}
                  className="flex-1 ml-2"
                />
                <Button onClick={sendGroupMessage} className="ml-2"><Send className="w-4 h-4"/></Button>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Join the demo group to test group bot fallback.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
