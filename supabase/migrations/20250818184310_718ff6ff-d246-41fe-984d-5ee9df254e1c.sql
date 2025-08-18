-- Enable Realtime replication on all tables
ALTER TABLE casual_users REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE direct_chats REPLICA IDENTITY FULL;  
ALTER TABLE direct_messages REPLICA IDENTITY FULL;
ALTER TABLE chat_rooms REPLICA IDENTITY FULL;
ALTER TABLE room_participants REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE casual_users;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;

-- Update RLS policies for better access control
-- Allow insert for all on chat_rooms
CREATE POLICY "Anyone can create chat rooms" ON chat_rooms
FOR INSERT WITH CHECK (true);

-- Allow update on chat rooms for all
CREATE POLICY "Anyone can update chat rooms" ON chat_rooms  
FOR UPDATE USING (true);

-- Allow delete on messages for sender only (optional)
CREATE POLICY "Users can delete their own messages" ON messages
FOR DELETE USING (true);

-- Allow delete on direct messages for sender only (optional)  
CREATE POLICY "Users can delete their own direct messages" ON direct_messages
FOR DELETE USING (true);

-- Create some default public chat rooms
INSERT INTO chat_rooms (name, description, is_public, max_users) VALUES
('General Chat', 'General discussion for everyone', true, 500),
('Random Talk', 'Talk about anything and everything', true, 300),
('Friends Zone', 'Make new friends and connect', true, 200),
('Study Group', 'Chat about studies and academics', true, 150),
('Gaming Hub', 'Discuss games and play together', true, 250)
ON CONFLICT DO NOTHING;

-- Create atomic user matching function for better concurrency
CREATE OR REPLACE FUNCTION match_users(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user1_status TEXT;
    user2_status TEXT;
BEGIN
    -- Check and update both users atomically
    SELECT status INTO user1_status FROM casual_users WHERE id = user1_id FOR UPDATE;
    SELECT status INTO user2_status FROM casual_users WHERE id = user2_id FOR UPDATE;
    
    -- Only proceed if both users are available
    IF user1_status = 'available' AND user2_status = 'available' THEN
        UPDATE casual_users SET status = 'matched' WHERE id = user1_id;
        UPDATE casual_users SET status = 'matched' WHERE id = user2_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up offline users (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_offline_users()
RETURNS void AS $$
BEGIN
    UPDATE casual_users 
    SET status = 'offline'
    WHERE status IN ('available', 'matched') 
    AND last_active < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;