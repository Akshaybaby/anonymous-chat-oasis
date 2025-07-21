-- Create storage bucket for media sharing
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);

-- Create policies for chat media bucket
CREATE POLICY "Chat media are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat-media');

CREATE POLICY "Users can upload chat media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chat-media');

-- Create direct_chats table for one-to-one conversations
CREATE TABLE public.direct_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  user1_username TEXT NOT NULL,
  user2_username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- Enable RLS on direct_chats
ALTER TABLE public.direct_chats ENABLE ROW LEVEL SECURITY;

-- Create policies for direct_chats
CREATE POLICY "Anyone can create direct chats" 
ON public.direct_chats 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view direct chats" 
ON public.direct_chats 
FOR SELECT 
USING (true);

-- Create direct_messages table for one-to-one messages
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.direct_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_username TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'video'
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on direct_messages
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for direct_messages
CREATE POLICY "Anyone can create direct messages" 
ON public.direct_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view direct messages" 
ON public.direct_messages 
FOR SELECT 
USING (true);

-- Add media support to existing messages table
ALTER TABLE public.messages 
ADD COLUMN message_type TEXT DEFAULT 'text',
ADD COLUMN media_url TEXT;

-- Enable real-time for new tables
ALTER TABLE public.direct_chats REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;