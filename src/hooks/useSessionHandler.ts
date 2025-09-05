import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CasualUser {
  id: string;
  username: string;
  avatar_color: string;
  status: string;
}

export const useSessionHandler = (
  currentUser: CasualUser | null,
  onLogout: () => void
) => {
  const isLoggingOutRef = useRef(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current || !currentUser) return;
    
    isLoggingOutRef.current = true;
    
    try {
      // Set user status to offline
      await supabase
        .from('casual_users')
        .update({ status: 'offline' })
        .eq('id', currentUser.id);
        
      // Clear local storage
      localStorage.removeItem('casual_user');
      localStorage.removeItem('current_chat');
      localStorage.removeItem('chat_partner');
      
      onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [currentUser, onLogout]);

  useEffect(() => {
    if (!currentUser) return;

    // Handle beforeunload (page close/refresh)
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable logout on page close
      if (navigator.sendBeacon) {
        const logoutData = new FormData();
        logoutData.append('user_id', currentUser.id);
        navigator.sendBeacon('/api/logout', logoutData);
      }
      
      // Immediate local cleanup
      localStorage.removeItem('casual_user');
      localStorage.removeItem('current_chat');
      localStorage.removeItem('chat_partner');
    };

    // Handle visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away - update last_active but keep online
        supabase
          .from('casual_users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', currentUser.id);
      } else {
        // User returned - update status and last_active
        supabase
          .from('casual_users')
          .update({ 
            status: 'available',
            last_active: new Date().toISOString()
          })
          .eq('id', currentUser.id);
      }
    };

    // Handle focus/blur events
    const handleFocus = () => {
      if (currentUser) {
        supabase
          .from('casual_users')
          .update({ 
            status: 'available',
            last_active: new Date().toISOString()
          })
          .eq('id', currentUser.id);
      }
    };

    const handleBlur = () => {
      if (currentUser) {
        supabase
          .from('casual_users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', currentUser.id);
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Cleanup on unmount or user change
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      
      // If component unmounts, log user out
      if (currentUser && !isLoggingOutRef.current) {
        handleLogout();
      }
    };
  }, [currentUser, handleLogout]);

  return { handleLogout };
};
