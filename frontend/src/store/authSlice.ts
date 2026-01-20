import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '@/lib/auth/supabase';
import type { AuthenticatedUser } from '@/types/auth';

interface AuthState {
  signInLoading: boolean;
  signInError: string | null;
  signUpLoading: boolean;
  signUpError: string | null;
  signUpSuccess: boolean;
  signUpMessage: string | null;
}

const initialState: AuthState = {
  signInLoading: false,
  signInError: null,
  signUpLoading: false,
  signUpError: null,
  signUpSuccess: false,
  signUpMessage: null,
};

// Thunk to sign up user
export const signUpUser = createAsyncThunk(
  'auth/signUpUser',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        // Map Supabase errors to user-friendly messages
        let errorMessage = error.message;
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('at least 6 characters')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          // Check if Supabase is configured
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
            errorMessage = 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.';
          } else {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
          }
        }

        return rejectWithValue({ error: errorMessage });
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Account created! Please check your email to verify your account.',
          requiresVerification: true,
        };
      }

      // User logged in immediately (email confirmation not required)
      return {
        success: true,
        message: 'Account created successfully!',
        requiresVerification: false,
      };
    } catch (err) {
      // Handle network errors and other exceptions
      let errorMessage = 'Connection error. Please check your internet and try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
            errorMessage = 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.';
          } else {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
          }
        } else {
          errorMessage = err.message;
        }
      }

      return rejectWithValue({ error: errorMessage });
    }
  },
);

// Thunk to sign in user
export const signInUser = createAsyncThunk(
  'auth/signInUser',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Map Supabase errors to user-friendly messages
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials') || error.message.includes('Invalid')) {
          errorMessage = 'Invalid email or password.';
        } else if (error.message.includes('Email not confirmed') || error.message.includes('not confirmed')) {
          errorMessage = 'Please verify your email before signing in.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Too many sign in attempts. Please try again later.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          // Check if Supabase is configured
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
            errorMessage = 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.';
          } else {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
          }
        }

        return rejectWithValue({ error: errorMessage });
      }

      // Check if session exists
      if (data.session) {
        return { success: true };
      }

      // No session - email verification required
      return rejectWithValue({
        error: 'Please verify your email before signing in.',
      });
    } catch (err) {
      // Handle network errors and other exceptions
      let errorMessage = 'Connection error. Please check your internet and try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
            errorMessage = 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.';
          } else {
            errorMessage = 'Connection error. Please check your internet connection and try again.';
          }
        } else {
          errorMessage = err.message;
        }
      }

      return rejectWithValue({ error: errorMessage });
    }
  },
);

// Thunk to sign out user
export const signOutUser = createAsyncThunk(
  'auth/signOutUser',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return rejectWithValue({
          error: error.message || 'Failed to sign out. Please try again.',
        });
      }

      return { success: true };
    } catch (err) {
      return rejectWithValue({
        error: err instanceof Error ? err.message : 'Failed to sign out. Please try again.',
      });
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearSignInError: (state) => {
      state.signInError = null;
    },
    clearSignUpError: (state) => {
      state.signUpError = null;
    },
    clearSignUpSuccess: (state) => {
      state.signUpSuccess = false;
      state.signUpMessage = null;
    },
    clearAllErrors: (state) => {
      state.signInError = null;
      state.signUpError = null;
    },
  },
  extraReducers: (builder) => {
    // signUpUser
    builder
      .addCase(signUpUser.pending, (state) => {
        state.signUpLoading = true;
        state.signUpError = null;
        state.signUpSuccess = false;
        state.signUpMessage = null;
      })
      .addCase(signUpUser.fulfilled, (state, action) => {
        state.signUpLoading = false;
        state.signUpSuccess = true;
        state.signUpMessage = action.payload.message;
      })
      .addCase(signUpUser.rejected, (state, action) => {
        state.signUpLoading = false;
        const payload = action.payload as { error?: string };
        if (payload?.error) {
          state.signUpError = payload.error;
        }
      });

    // signInUser
    builder
      .addCase(signInUser.pending, (state) => {
        state.signInLoading = true;
        state.signInError = null;
      })
      .addCase(signInUser.fulfilled, (state) => {
        state.signInLoading = false;
        state.signInError = null;
      })
      .addCase(signInUser.rejected, (state, action) => {
        state.signInLoading = false;
        const payload = action.payload as { error?: string };
        if (payload?.error) {
          state.signInError = payload.error;
        }
      });

    // signOutUser
    builder
      .addCase(signOutUser.fulfilled, (state) => {
        // Clear all auth state on successful sign out
        state.signInError = null;
        state.signUpError = null;
        state.signUpSuccess = false;
        state.signUpMessage = null;
      })
      .addCase(signOutUser.rejected, (state) => {
        // Even if sign out fails, we can still clear local state
        // The error can be handled by the component
      });
  },
});

export const {
  clearSignInError,
  clearSignUpError,
  clearSignUpSuccess,
  clearAllErrors,
} = authSlice.actions;

export default authSlice.reducer;
