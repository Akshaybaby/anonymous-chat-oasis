"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MediaUpload } from "@/components/ui/media-upload";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

// -------------------------
// Helpers
// -------------------------
const BOT_NAMES = [
  "Rahul","Sneha","Arjun","Mariya","Fathima",
  "Anna","Caroline","Safiya","Jeni","Jennifer","Nicole"
];

const avatarColors = [
  "bg-red-500","bg-blue-500","bg-green-500","bg-yellow-500",
  "bg-purple-500","bg-pink-500","bg-indigo-500","bg-teal-500"
];

const randomDelay = (min=700, max=1800) =>
  Math.floor(min + Math.random()*(max-min));

const botReply = (humanMsg: string) => {
  const starters = [
    "Interesting! ","Got it. ","Makes sense. ",
    "Haha, true. ","I see. ","Tell me more— "
  ];
  const followups = [
    "what do you think?","how did that happen?",
    "have you tried anything else?","why do you feel that way?",
    "that's pretty cool.","I'm curious now."
  ];
  const echo = humanMsg.slice(0, 140);
  return `${starters[Math.floor(Math.random()*starters.length)]}${echo ? `"${echo}" — ` : ""}${followups[Math.floor(Math.random()*followups.length)]}`;
};

// -------------------------
// Chat Component
// -------------------------
export default function Chat() {
  const [username, setUsername] = useState("");
  const [currentUser, setCurrentUser] = useState<CasualUser | null>(null);
  const [currentChatPartner, setCurrentChatPartner] = useState<CasualUser | null>(null);
  const [currentDirectChat, setCurrentDirectChat] = useState<DirectChat | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isSearchingForMatch, setIsSearchingForMatch] = useState(false);

  const messageChannelRef = useRef<any>(null);
  const partnerPresenceChannelRef = useRef<any>(null);
  const botTimerRef = useRef<NodeJS.Timeout | null>(null);

  // -------------------------
  // Ensure bots exist
  // -------------------------
  const ensureBotsExist = useCallback(async () => {
    const { data: existing } = await supabase
      .from("casual_users")
      .select("username")
      .in("username", BOT_NAMES);

    const existingSet = new Set((existing || []).map(r => r.username));
    const toCreate = BOT_NAMES.filter(n => !existingSet.has(n));

    if (toCreate.length) {
      const rows = toCreate.map(n => ({
        username: n,
        avatar_color: avatarColors[Math.floor(Math.random()*avatarColors.length)],
        status: "available",
        is_bot: true,
        last_active: new Date().toISOString()
      }));
      await supabase.from("casual_users").insert(rows);
    }
  }, []);

  // -------------------------
  // Create user
  // -------------------------
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
    const avatarColor = avatarColors[Math.floor(Math.random()*avatarColors.length)];
    const sessionId = crypto.randomUUID();

    try {
      const { data, error } = await supabase
        .from("casual_users")
        .insert({
          username: username.trim(),
          avatar_color: avatarColor,
          status: "available",
          last_active: new Date().toISOString(),
          is_bot: false,
          session_id: sessionId,
          session_revoked: false
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentUser(data);
      localStorage.setItem("casual_user", JSON.stringify(data));

      await ensureBotsExist();

      const revoke = async () => {
        if (data?.id) {
          await supabase.rpc("leave_chat", { p_user_id: data.id }).catch(()=>{});
          await supabase.from("casual_users")
            .update({ status: "available", session_revoked: true })
            .eq("id", data.id);
        }
      };
      window.addEventListener("beforeunload", revoke);
    } catch (e) {
      console.error("Error creating user:", e);
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  // -------------------------
  // Matchmaking
  // -------------------------
  const findMatch = useCallback(async () => {
    if (!currentUser || currentDirectChat) return;

    try {
      const { data: humans } = await supabase
        .from("casual_users")
        .select("*")
        .eq("status","available")
        .eq("is_bot", false)
        .neq("id", currentUser.id)
        .gte("last_active", new Date(Date.now() - 60000).toISOString())
        .order("last_active",{ ascending:false })
        .limit(5);

      let targetUser: CasualUser | null = null;
      if (humans && humans.length) {
        targetUser = humans[0];
      } else {
        const { data: bots } = await supabase
          .from("casual_users")
          .select("*")
          .eq("status","available")
          .eq("is_bot", true)
          .order("last_active",{ ascending:false })
          .limit(1);
        if (bots && bots.length) {
          targetUser = bots[0];
        }
      }

      if (targetUser) {
        await supabase.rpc("atomic_match_users", {
          user1_id: currentUser.id,
          user2_id: targetUser.id
        });

        const { data: chatData, error: chatError } = await supabase
          .from("direct_chats")
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

          localStorage.setItem("current_chat", JSON.stringify(chatData));
          localStorage.setItem("chat_partner", JSON.stringify(targetUser));

          toast({ title: "Connected!", description: `You're now chatting with ${targetUser.username}` });
        }
      }
    } catch (error) {
      console.error("Error finding match:", error);
    }
  }, [currentUser, currentDirectChat]);

  const startMatching = useCallback(() => {
    setIsSearchingForMatch(true);
    findMatch();
    const interval = setInterval(findMatch, 5000);
    return () => clearInterval(interval);
  }, [findMatch]);

  // -------------------------
  // Partner presence
  // -------------------------
  const watchPartnerPresence = useCallback(() => {
    if (!currentChatPartner) return;
    if (partnerPresenceChannelRef.current) return;

    partnerPresenceChannelRef.current = supabase
      .channel(`presence-${currentChatPartner.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "casual_users",
        filter: `id=eq.${currentChatPartner.id}`
      }, (payload) => {
        const row = payload.new as CasualUser;
        if (row.status !== "matched" || row.session_revoked) {
          setCurrentChatPartner(null);
          setCurrentDirectChat(null);
          setDirectMessages([]);
          localStorage.removeItem("current_chat");
          localStorage.removeItem("chat_partner");
          toast({ title: "Partner left", description: "Finding a new match..." });
          startMatching();
          if (partnerPresenceChannelRef.current) {
            supabase.removeChannel(partnerPresenceChannelRef.current);
            partnerPresenceChannelRef.current = null;
          }
        }
      })
      .subscribe();
  }, [currentChatPartner, startMatching]);

  // -------------------------
  // Load messages
  // -------------------------
  const loadMessages = useCallback(async () => {
    if (!currentDirectChat) return;
    const { data, error } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("chat_id", currentDirectChat.id)
      .order("created_at", { ascending:true });
    if (!error && data) setDirectMessages(data);
  }, [currentDirectChat]);

  // -------------------------
  // Subscription
  // -------------------------
  const setupMessageSubscription = useCallback(() => {
    if (!currentDirectChat) return;
    if (messageChannelRef.current) return;

    messageChannelRef.current = supabase
      .channel(`chat-${currentDirectChat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `chat_id=eq.${currentDirectChat.id}`
      }, (payload) => {
        const newMessage = payload.new as DirectMessage;
        setDirectMessages(prev => [...prev, newMessage]);

        // If chatting with a bot, auto-reply
        if (currentChatPartner?.is_bot && newMessage.sender_id === currentUser?.id) {
          if (botTimerRef.current) clearTimeout(botTimerRef.current);
          botTimerRef.current = setTimeout(async () => {
            await supabase.from("direct_messages").insert({
              chat_id: currentDirectChat.id,
              sender_id: currentChatPartner.id,
              sender_username: currentChatPartner.username,
              content: botReply(newMessage.content || ""),
              message_type: "text"
            });
            await supabase.from("casual_users").update({
              last_active: new Date().toISOString(),
              status: "matched"
            }).eq("id", currentChatPartner.id);
          }, randomDelay());
        }
      })
      .subscribe();
  }, [currentDirectChat, currentChatPartner, currentUser]);

  // -------------------------
  // Effects
  // -------------------------
  useEffect(() => {
    const saved = localStorage.getItem("casual_user");
    if (!saved) return;
    const user = JSON.parse(saved) as CasualUser;
    supabase.from("casual_users").select("id, session_revoked")
      .eq("id", user.id).single()
      .then(({ data }) => {
        if (!data || data.session_revoked) {
          localStorage.removeItem("casual_user");
          localStorage.removeItem("current_chat");
          localStorage.removeItem("chat_partner");
          setCurrentUser(null);
        } else {
          setCurrentUser(user);
        }
      });
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

  // -------------------------
  // Send message
  // -------------------------
  const sendMessage = async () => {
    if (!messageInput.trim() || !currentUser || !currentDirectChat) return;
    await supabase.from("direct_messages").insert({
      chat_id: currentDirectChat.id,
      sender_id: currentUser.id,
      sender_username: currentUser.username,
      content: messageInput,
      message_type: "text"
    });
    setMessageInput("");
  };

  // -------------------------
  // Skip to next user
  // -------------------------
  const skipToNextUser = async () => {
    if (!currentChatPartner || !currentUser) return;
    const partnerName = currentChatPartner.username;
    await Promise.all([
      supabase.from("casual_users").update({ status:"available" }).eq("id", currentChatPartner.id),
      supabase.from("casual_users").update({ status:"available" }).eq("id", currentUser.id)
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
    localStorage.removeItem("current_chat");
    localStorage.removeItem("chat_partner");
    toast({ title: "Finding new person", description: `Left chat with ${partnerName}. Looking for someone new...` });
    startMatching();
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="flex flex-col h-screen w-full">
      {!currentUser ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Input
            placeholder="Enter a username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={createUser} disabled={isJoining} className="mt-2">
            {isJoining ? "Joining..." : "Join Chat"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {currentChatPartner ? (
            <>
              <div className="flex items-center p-2 border-b">
                <Avatar className="mr-2">
                  <AvatarFallback className={currentChatPartner.avatar_color}>
                    {currentChatPartner.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{currentChatPartner.username}</span>
                <Button onClick={skipToNextUser} className="ml-auto">Skip</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {directMessages.map(m => (
                  <div key={m.id} className={`mb-2 ${m.sender_id === currentUser.id ? "text-right" : "text-left"}`}>
                    <div className="inline-block px-3 py-2 rounded-lg bg-gray-200">
                      {m.message_type === "text" && <span>{m.content}</span>}
                      {m.message_type === "image" && <img src={m.media_url!} className="max-w-xs rounded" />}
                      {m.message_type === "video" && (
                        <video controls className="max-w-xs rounded">
                          <source src={m.media_url!} type="video/mp4" />
                        </video>
                      )}
                      {m.message_type === "file" && (
                        <a href={m.media_url!} target="_blank" rel="noreferrer" className="underline">
                          Download file
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center p-2 border-t">
                <MediaUpload onMediaUploaded={async (url, type) => {
                  if (!currentUser || !currentDirectChat) return;
                  await supabase.from("direct_messages").insert({
                    chat_id: currentDirectChat.id,
                    sender_id: currentUser.id,
                    sender_username: currentUser.username,
                    content: type === "image" ? "[image]" : type === "video" ? "[video]" : "[file]",
                    message_type: type,
                    media_url: url
                  });
                }} />
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1 ml-2"
                />
                <Button onClick={sendMessage} className="ml-2">Send</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              {isSearchingForMatch ? (
                <p>Searching for a match...</p>
              ) : (
                <Button onClick={startMatching}>Start Chatting</Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
