-- Create atomic user matching function
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

-- Enable realtime for tables to ensure instant updates
ALTER TABLE casual_users REPLICA IDENTITY FULL;
ALTER TABLE direct_chats REPLICA IDENTITY FULL;  
ALTER TABLE direct_messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE casual_users;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;