import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import React from 'react';
import ScreenWrapper from '../../components/ScreenWrapper';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import Header from '../../components/Header';
import { hp, wp } from '../../helpers/commons';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/themes';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';

const Profile = () => {
  const { user, setAuth } = useAuth();
  const router = useRouter();

  const onLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setAuth(null); // Clear user state
      setTimeout(() => {
        router.replace('/welcome'); // Navigate after logout
      }, 100); // Small delay to ensure state updates
    } catch (error) {
      Alert.alert('Sign Out', "Error signing out!");
      console.log("Logout Error:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Confirm', "Are you sure you want to log out?", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: onLogout, style: 'destructive' }
    ]);
  };

  return (
    <ScreenWrapper bg="white">
      <UserHeader user={user} router={router} handleLogout={handleLogout} />
    </ScreenWrapper>
  );
};

const UserHeader = ({ user, router, handleLogout }) => {
  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerSection}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.profileContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Avatar 
              uri={user?.image} 
              size={hp(16)} 
              rounded={80} 
            />
          </View>
          <Text style={styles.userName}>{user?.name || "No Name"}</Text>
          <Button
            title="Edit Profile"
            buttonStyle={styles.editButton}
            textStyle={styles.editButtonText}
            onPress={() => router.push('editProfile')}
          />
        </View>

        {/* Info Cards Section */}
        <View style={styles.infoSection}>
          <InfoCard 
            icon="mail-outline" 
            label="Email" 
            value={user?.email || "No Email"} 
          />
          <InfoCard 
            icon="location-outline" 
            label="Address" 
            value={user?.address || "No Address"} 
          />
          {user?.phoneNumber && (
            <InfoCard 
              icon="call-outline" 
              label="Phone" 
              value={user.phoneNumber} 
            />
          )}
          {user?.bio && (
            <InfoCard 
              icon="information-circle-outline" 
              label="Bio" 
              value={user.bio} 
            />
          )}
        </View>
      </View>
    </View>
  );
};

// New InfoCard component
const InfoCard = ({ icon, label, value }) => (
  <View style={styles.infoCard}>
    <View style={styles.infoIconContainer}>
      <Ionicons name={icon} size={20} color="#007AFF" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: wp(4),
  },
  headerSection: {
    paddingVertical: hp(2),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: hp(2.5),
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    position: 'absolute',
    right: 0,
  },
  profileContent: {
    flex: 1,
    gap: hp(4),
  },
  avatarSection: {
    alignItems: 'center',
    gap: hp(2),
  },
  avatarContainer: {
    height: hp(16),
    width: hp(16),
    borderRadius: hp(8),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    fontSize: hp(2.5),
    fontWeight: '600',
    color: '#333333',
  },
  editButton: {
    paddingHorizontal: wp(8),
    height: hp(4.5),
    borderRadius: 25,
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: 'white',
  },
  infoSection: {
    gap: hp(2),
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: wp(4),
    borderRadius: 15,
    gap: wp(3),
  },
  infoIconContainer: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: hp(1.6),
    color: '#666666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: hp(1.8),
    color: '#333333',
    fontWeight: '500',
  },
});

export default Profile;