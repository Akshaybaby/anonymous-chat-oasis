-- Add status column to track user availability for matching
ALTER TABLE public.casual_users 
ADD COLUMN status TEXT DEFAULT 'available' CHECK (status IN ('available', 'matched', 'offline'));

-- Add index for faster queries on status
CREATE INDEX idx_casual_users_status ON public.casual_users(status);

-- Add index for faster queries on last_active
CREATE INDEX idx_casual_users_last_active ON public.casual_users(last_active);

-- Update the existing users to have available status
UPDATE public.casual_users SET status = 'available';