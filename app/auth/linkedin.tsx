import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';

// Get LinkedIn credentials from app.config.js
const CLIENT_ID = Constants.expoConfig?.extra?.linkedinClientId || '86idq38i2uossd';
const CLIENT_SECRET = Constants.expoConfig?.extra?.linkedinClientSecret;

// This should match the redirect URI you set in your LinkedIn app settings
const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'deeptalk-health',
  path: 'auth/linkedin',
});

console.log('Redirect URI:', REDIRECT_URI); // For debugging purposes
console.log('Client ID:', CLIENT_ID);
console.log('Has Client Secret:', !!CLIENT_SECRET);

// Configure the LinkedIn authorization endpoints for OpenID Connect
const discovery = {
  authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
  // Add the userinfo endpoint for OpenID Connect
  userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
};

// Define the LinkedIn user profile interface
interface LinkedInUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string;
  headline: string;
  industry: string;
  location: {
    country: string;
    city: string;
  };
  connections: number;
  rawProfileData?: any;
  rawEmailData?: any;
  error?: string;
}

// Register for native authentication
WebBrowser.maybeCompleteAuthSession();

export default function LinkedInSignIn() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<LinkedInUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create an auth request using OpenID Connect
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      // Use the OpenID Connect scopes as per the latest documentation
      scopes: ['openid', 'profile', 'email'],
      redirectUri: REDIRECT_URI,
      responseType: 'code',
    },
    discovery
  );

  useEffect(() => {
    console.log('Auth response:', response);
    if (response?.type === 'success') {
      setLoading(true);
      const { code } = response.params;
      console.log('Received authorization code:', code);
      
      // Exchange the authorization code for an access token and ID token
      exchangeCodeForToken(code);
    } else if (response?.type === 'error') {
      console.error('Authentication error:', response.error);
      setError(`Authentication failed: ${response.error?.message || 'Unknown error'}`);
    }
  }, [response]);

  const exchangeCodeForToken = async (code: string) => {
    try {
      console.log('Exchanging code for token...');
      
      // Prepare the token request
      const tokenRequest = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET || '', 
        redirect_uri: REDIRECT_URI,
      });
      
      console.log('Token request parameters:', {
        grant_type: 'authorization_code',
        code: code.substring(0, 10) + '...',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET ? '[HIDDEN]' : 'MISSING',
        redirect_uri: REDIRECT_URI,
      });
      
      // Exchange the code for an access token and ID token
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenRequest.toString(),
      });
      
      console.log('Token response status:', tokenResponse.status);
      const tokenData = await tokenResponse.json();
      console.log('Token response data:', tokenData);
      
      if (tokenData.access_token) {
        console.log('Successfully obtained access token');
        
        // With OpenID Connect, we should get an ID token as well
        if (tokenData.id_token) {
          console.log('ID token received, parsing...');
          // Parse the ID token (it's a JWT)
          try {
            // Split the JWT and get the payload part (second part)
            const payloadBase64 = tokenData.id_token.split('.')[1];
            // Base64 decode and parse as JSON
            const payloadJson = atob(payloadBase64);
            const idTokenPayload = JSON.parse(payloadJson);
            console.log('ID token payload:', idTokenPayload);
            
            // Use the ID token payload to get user info
            setUserInfo({
              id: idTokenPayload.sub || 'unknown',
              firstName: idTokenPayload.given_name || 'Unknown',
              lastName: idTokenPayload.family_name || 'User',
              email: idTokenPayload.email || 'No email available',
              profilePicture: idTokenPayload.picture || 'https://example.com/profile.jpg',
              headline: idTokenPayload.headline || 'LinkedIn User',
              industry: idTokenPayload.industry || 'Not available',
              location: {
                country: idTokenPayload.country || 'Unknown',
                city: idTokenPayload.locality || 'Unknown'
              },
              connections: 0,
              rawProfileData: idTokenPayload
            });
            setLoading(false);
          } catch (jwtError) {
            console.error('Error parsing ID token:', jwtError);
            // Fall back to userinfo endpoint
            fetchUserInfoWithToken(tokenData.access_token);
          }
        } else {
          // If no ID token, use the userinfo endpoint
          fetchUserInfoWithToken(tokenData.access_token);
        }
      } else {
        console.error('Token response error:', tokenData);
        setError('Failed to get access token: ' + (tokenData.error_description || 'Unknown error'));
        setLoading(false);
      }
    } catch (err) {
      console.error('Token exchange error:', err);
      setError(`Failed to exchange code for token: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  const fetchUserInfoWithToken = async (accessToken: string) => {
    try {
      console.log('Fetching user info with token...');
      // Use the OpenID Connect userinfo endpoint
      const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      console.log('UserInfo response status:', userInfoResponse.status);
      const userInfoData = await userInfoResponse.json();
      console.log('UserInfo data:', userInfoData);
      
      if (userInfoData && !userInfoData.error) {
        // Process the userinfo response
        const userProfile: LinkedInUserProfile = {
          id: userInfoData.sub || 'unknown',
          firstName: userInfoData.given_name || 'Unknown',
          lastName: userInfoData.family_name || 'User',
          email: userInfoData.email || 'No email available',
          profilePicture: userInfoData.picture || 'https://example.com/profile.jpg',
          headline: userInfoData.headline || 'LinkedIn User',
          industry: userInfoData.industry || 'Not available',
          location: {
            country: userInfoData.country || 'Unknown',
            city: userInfoData.locality || 'Unknown'
          },
          connections: 0,
          // Store the raw response for display
          rawProfileData: userInfoData
        };
        
        setUserInfo(userProfile);
      } else {
        // If we couldn't get real data, use simulated data
        const simulatedUserInfo: LinkedInUserProfile = {
          id: 'authenticated',
          firstName: 'LinkedIn',
          lastName: 'User',
          email: 'No email available',
          profilePicture: 'https://example.com/profile.jpg',
          headline: 'Authentication Successful',
          industry: 'Not available',
          location: {
            country: 'Unknown',
            city: 'Unknown'
          },
          connections: 0,
          // Add the error information
          rawProfileData: userInfoData || { message: 'No profile data available' },
          error: userInfoData?.error || 'Failed to fetch user info'
        };
        
        setUserInfo(simulatedUserInfo);
      }
    } catch (err) {
      console.error('UserInfo fetch error:', err);
      setError(`Failed to fetch user info: ${err instanceof Error ? err.message : String(err)}`);
      
      // Even if there's an error, show simulated data for demo purposes
      const simulatedUserInfo: LinkedInUserProfile = {
        id: 'authenticated',
        firstName: 'LinkedIn',
        lastName: 'User',
        email: 'No email available',
        profilePicture: 'https://example.com/profile.jpg',
        headline: 'Authentication Successful',
        industry: 'Not available',
        location: {
          country: 'Unknown',
          city: 'Unknown'
        },
        connections: 0,
        error: String(err)
      };
      
      setUserInfo(simulatedUserInfo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backButtonText}>← Back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.title}>LinkedIn Sign In</ThemedText>
      </View>

      {!userInfo ? (
        <View style={styles.signInContainer}>
          <ThemedText style={styles.description}>
            Sign in with your LinkedIn account to continue
          </ThemedText>
          
          {loading ? (
            <ActivityIndicator size="large" color="#0077B5" />
          ) : (
            <TouchableOpacity
              style={styles.linkedinButton}
              onPress={() => promptAsync()}
              disabled={!request}
            >
              <Text style={styles.linkedinButtonText}>Sign in with LinkedIn</Text>
            </TouchableOpacity>
          )}
          
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          
          <ThemedText style={styles.note}>
            Note: You will be redirected to LinkedIn to complete the authentication process.
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.profileContainer}>
          <ThemedText style={styles.profileTitle}>LinkedIn Profile Information</ThemedText>
          
          <View style={styles.profileCard}>
            <ThemedText style={styles.profileName}>
              {userInfo.firstName} {userInfo.lastName}
            </ThemedText>
            
            <ThemedText style={styles.profileHeadline}>
              {userInfo.headline}
            </ThemedText>
            
            <View style={styles.profileDetail}>
              <ThemedText style={styles.profileLabel}>Email:</ThemedText>
              <ThemedText style={styles.profileValue}>{userInfo.email}</ThemedText>
            </View>
            
            <View style={styles.profileDetail}>
              <ThemedText style={styles.profileLabel}>Industry:</ThemedText>
              <ThemedText style={styles.profileValue}>{userInfo.industry}</ThemedText>
            </View>
            
            <View style={styles.profileDetail}>
              <ThemedText style={styles.profileLabel}>Location:</ThemedText>
              <ThemedText style={styles.profileValue}>
                {userInfo.location.city}, {userInfo.location.country}
              </ThemedText>
            </View>
            
            <View style={styles.profileDetail}>
              <ThemedText style={styles.profileLabel}>Connections:</ThemedText>
              <ThemedText style={styles.profileValue}>{userInfo.connections}+</ThemedText>
            </View>
            
            {userInfo.error && (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorTitle}>Error Details:</ThemedText>
                <ThemedText style={styles.errorText}>{userInfo.error}</ThemedText>
              </View>
            )}
            
            <View style={styles.jsonContainer}>
              <ThemedText style={styles.jsonTitle}>Raw Profile Data:</ThemedText>
              <ScrollView style={styles.jsonScrollView}>
                <ThemedText style={styles.jsonText}>
                  {JSON.stringify(userInfo.rawProfileData || userInfo, null, 2)}
                </ThemedText>
              </ScrollView>
            </View>
            
            <View style={styles.jsonContainer}>
              <ThemedText style={styles.jsonTitle}>Raw Email Data:</ThemedText>
              <ScrollView style={styles.jsonScrollView}>
                <ThemedText style={styles.jsonText}>
                  {JSON.stringify(userInfo.rawEmailData || {}, null, 2)}
                </ThemedText>
              </ScrollView>
            </View>
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  linkedinButton: {
    backgroundColor: '#0077B5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 24,
  },
  linkedinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
  note: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 16,
  },
  profileContainer: {
    flex: 1,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  profileHeadline: {
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.8,
  },
  profileDetail: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  profileLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 100,
  },
  profileValue: {
    fontSize: 16,
    flex: 1,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#ffeeee',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#cc0000',
    marginBottom: 8,
  },
  jsonContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#eee',
    borderRadius: 8,
    marginBottom: 16,
  },
  jsonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  jsonScrollView: {
    maxHeight: 200,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
