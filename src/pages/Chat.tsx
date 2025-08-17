import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  user_id: string;
  content: string | null;
  image_url?: string | null;
  created_at: string;
}

interface DirectMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  image_url?: string | null;
  created_at: string;
}

const Chat = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [currentDirectChat, setCurrentDirectChat] = useState<any>(null);
  const [messageChannels, setMessageChannels] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, directMessages]);

  // ✅ Realtime subscription for public messages
  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ✅ Handle file upload
  const handleFileUpload = async (): Promise<string | null> => {
    if (!file) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("chat-uploads") // ⚡ Make sure you created this bucket in Supabase Storage
      .upload(fileName, file);

    if (error) {
      toast({ title: "Upload Error", description: error.message, variant: "destructive" });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("chat-uploads")
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  };

  // ✅ Send message with optional image
  const sendMessage = async () => {
    if (!message.trim() && !file) return;

    let imageUrl = null;
    if (file) {
      imageUrl = await handleFileUpload();
      setFile(null);
    }

    if (currentDirectChat) {
      const { error } = await supabase.from("direct_messages").insert({
        chat_id: currentDirectChat.id,
        sender_id: "anon-user",
        content: message.trim() || null,
        image_url: imageUrl,
      });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await supabase.from("messages").insert({
        user_id: "anon-user",
        content: message.trim() || null,
        image_url: imageUrl,
      });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }

    setMessage("");
  };

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardContent className="flex-1 p-4 flex flex-col">
        <ScrollArea className="flex-1">
          {currentDirectChat
            ? directMessages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <b>{msg.sender_id}</b>: {msg.content}
                  {msg.image_url && (
                    <div>
                      <img
                        src={msg.image_url}
                        alt="uploaded"
                        className="mt-2 max-w-[200px] rounded-lg"
                      />
                    </div>
                  )}
                </div>
              ))
            : messages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <b>{msg.user_id}</b>: {msg.content}
                  {msg.image_url && (
                    <div>
                      <img
                        src={msg.image_url}
                        alt="uploaded"
                        className="mt-2 max-w-[200px] rounded-lg"
                      />
                    </div>
                  )}
                </div>
              ))}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input + File Upload */}
        <div className="flex mt-2 items-center space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Chat;
