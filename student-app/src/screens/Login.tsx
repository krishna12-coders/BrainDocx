import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login, register, loginWithGoogle } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all credentials.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await register(email.trim(), password.trim(), name.trim());
      } else {
        await login(email.trim(), password.trim());
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>BrainDocx</Text>
          <Text style={styles.subtitle}>Secure Study Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isSignUp ? 'Create Student Account' : 'Student Sign In'}</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="student@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.submitBtn, styles.googleBtn]} 
            onPress={loginWithGoogle} 
            disabled={loading}
          >
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            disabled={loading}
          >
            <Text style={styles.toggleBtnText}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#3b82f6',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  googleBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
    marginTop: 10,
  },
  googleBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
