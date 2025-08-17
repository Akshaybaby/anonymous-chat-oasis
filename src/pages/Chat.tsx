import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient"; // adjust path if needed

interface Message {
  id: string;
  pair_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export default function Chat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // Restore chat if page refreshed
  useEffect(() => {
    const savedPair = localStorage.getItem("pair_id");
    if (savedPair) {
      setPairId(savedPair);
    }
  }, []);

  // Start chat matchmaking
  const startChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Look for existing open pair
    const { data: openPairs } = await supabase
      .from("pairs")
      .select("*")
      .is("user2", null)
      .limit(1);

    let pair;
    if (openPairs && openPairs.length > 0) {
      const { data } = await supabase
        .from("pairs")
        .update({ user2: user.id })
        .eq("id", openPairs[0].id)
        .select()
        .single();
      pair = data;
    } else {
      const { data } = await supabase
        .from("pairs")
        .insert([{ user1: user.id }])
        .select()
        .single();
      pair = data;
    }

    if (pair) {
      setPairId(pair.id);
      localStorage.setItem("pair_id", pair.id);
    }
  };

  // Realtime subscription + load last 10 messages
  useEffect(() => {
    if (!pairId) return;

    // Subscribe for new messages
    const channel = supabase
      .channel("chat-room-" + pairId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `pair_id=eq.${pairId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    // Load last 10 messages when user joins
    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("pair_id", pairId)
        .order("created_at", { ascending: true })
        .limit(10);
      if (data) setMessages(data);
    };
    loadMessages();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pairId]);

  // Send new message
  const sendMessage = async () => {
    if (!input.trim() || !pairId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("messages").insert([
      { pair_id: pairId, user_id: user.id, content: input },
    ]);

    setInput("");
  };

  // Disconnect cleanup
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (pairId && userId) {
        await supabase.from("pairs").update({ active: false }).eq("id", pairId);
        localStorage.removeItem("pair_id");
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pairId, userId]);

  return (
    <div className="chat-container">
      {!pairId ? (
        <button onClick={startChat} className="start-chat-btn">
          Start Chatting
        </button>
      ) : (
        <div className="chat-box">
          <div className="messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={msg.user_id === userId ? "message own" : "message"}
              >
                {msg.content}
              </div>
            ))}
          </div>
          <div className="input-box">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
