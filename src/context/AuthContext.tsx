import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ensureProfileExists = async (currentUser: User) => {
      try {
        const { user_metadata } = currentUser;
        const full_name = user_metadata?.full_name || '';
        const parts = full_name.split(' ');
        const first_name = parts[0] || '';
        const last_name = parts.length > 1 ? parts.slice(1).join(' ') : '';
        const avatar_url = user_metadata?.avatar_url || '';

        // Check if profile exists first to safely avoid RLS upsert permission issues
        const { error: matchError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', currentUser.id)
          .single();

        if (matchError && matchError.code === 'PGRST116') {
          // Check for pending invitations to get the owner-specified name
          const { data: invitations } = await supabase
            .from('member_invitations')
            .select('name')
            .eq('email', currentUser.email?.toLowerCase())
            .limit(1);

          const invitedName = invitations?.[0]?.name;
          const finalFirstName = invitedName ? invitedName.split(' ')[0] : first_name;
          const finalLastName = invitedName ? (invitedName.split(' ').slice(1).join(' ') || last_name) : last_name;

          // Profile not found, so we insert
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: currentUser.id,
              first_name: finalFirstName,
              last_name: finalLastName,
              nickname: finalFirstName,
              avatar_url
            });
             
          if (insertError) {
            console.error('Error inserting profile:', insertError);
          } else {
            // Process the actual joining logic via RPC
            await supabase.rpc('process_pending_invitations');
          }
        } else if (matchError) {
          console.error('Error checking profile existence:', matchError);
        } else {
          // Even if profile exists, try processing invitations just in case 
          // they were invited to a new club since their last login.
          await supabase.rpc('process_pending_invitations');
        }
      } catch (error) {
        console.error('Error ensuring profile exists:', error);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfileExists(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfileExists(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
