import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import React from 'react'
import ScreenWrapper from '../../components/ScreenWrapper'
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import Header from '../../components/Header';
import { hp, wp } from '../../helpers/commons';
import Icon from '../../assets/icons';
import { theme } from '../../constants/themes';
import { supabase } from '../../lib/supabase';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';

const Profile = () => {
  const {user, setAuth} = useAuth();
  const router = useRouter();

  const onLogout = async () =>{
          setAuth(null);
          const {error} = await supabase.auth.signOut();
  
          if(error){
              Alert.alert('Sign Out', "Error signing out!");
          }
}

  const handleLogout = async () =>{
    Alert.alert('Confirm', "Are you sure you want log out?",[
      {
        text: 'Cancel',
        onPress: ()=> console.log('modal cancelled'),
        style: 'cancel'
      },

      {
        text: 'Logout',
        onPress: ()=> onLogout(),
        style: 'destructive'
      }

    ])
}

  return (
    <ScreenWrapper bg="white">
      <UserHeader user={user} router={router} handleLogout={handleLogout}/>
    </ScreenWrapper>
  )
}

const UserHeader = ({user, router, handleLogout}) => {
  console.log("User image URL:", user?.image);
  return(
    <View style={{flex: 1, backgroundColor: 'white', paddingHorizontal: wp(4)}}>
      
      <View>

      <Header title="Profile" mb={20}/>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" color="grey"/>
      </TouchableOpacity>

      </View>

      <View style={styles.container}>
        <View style={{gap:15}}>
          <View style={styles.avatarContainer}>
            <Avatar
            uri={user?.image}
            size={hp(16)}
            rounded={theme.radius.xxl*1.4}
            />
          </View>
          
          <Button title="Edit Profile" buttonStyle={styles.editbutton} textStyle={{fontSize:16}} onPress={()=>router.push('editProfile')}/>

          <View style={{alignItems: 'center', gap: 4}}>
            <Text style={styles.username}>{user && user.name}</Text>
            <Text style={styles.infotext}>{user && user.address}</Text>
          </View>

          <View style={{gap : 10}}>

            <View style={styles.info}>
              <Text style={styles.infoText}>
                {user&&user.email}
              </Text>
            </View>

            {
              user && user.phoneNumber && (
                <View style={styles.info}>
                  <Text style={styles.infoText}>
                    {user&&user.phoneNumber}
                  </Text>
                </View>
              )
            }

            {
              user && user.bio &&(
                <Text style={styles.infoText}>{user.bio}</Text>
              )
            }

            

          </View>
          
        </View>
        
      </View>
    </View>

  )
}

export default Profile

const styles = StyleSheet.create({

  container: {
    flex: 1,
    
  },

  logoutButton:{
    position: 'absolute',
    right: 0,
    padding: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: 'pink',
    
  },

  headerContainer:{
    marginHorizontal: wp(4),
    marginBottom: 20,

  },

  avatarContainer:{
    height: hp(16),
    width:hp(16),
    alignSelf: 'center',
    backgroundColor: 'red',
    
  },

  editbutton:{
    width: hp(17),
    height: hp(4),
    alignSelf: 'center',
    borderRadius: theme.radius.xs,
    
  },

  username: {
    fontSize: hp(3),
    fontWeight : '500',
    color: theme.colors.textLight

  }




})