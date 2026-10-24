import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import ScreenWrapper from '../components/ScreenWrapper'
import Header from '../components/Header'
import { hp, wp } from '../helpers/commons'
import { Image } from 'expo-image'
import { useAuth } from '../context/AuthContext'
import { getUserImageSrc, uploadFile } from '../services/imageService'
import Icon from '../assets/icons'
import { theme } from '../constants/themes'
import Input from '../components/Input'
import Button from '../components/Button'
import { updateUser } from '../services/userService'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker';

const EditProfile = () => {

  const {user: currentUser, setUserData} = useAuth();

  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const[user, setUser] = useState({
    name: '',
    phoneNumber: '',
    image: null,
    bio:'',
    address:'', 
  })

  useEffect(()=>{
    if(currentUser){
      setUser({
        name: currentUser.name || '',
        phoneNumber: currentUser.phoneNumber || '',
        image: currentUser.image || null,
        address: currentUser.address || '',
        bio: currentUser.bio || '',
      }); 
    }
  }, [currentUser])
  
  
  const pickImage = async () =>{

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,  
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setUser({...user, image: result.assets[0]});
    }

  }

  const validatePhoneNumber = (phoneNumber) => {
    const phoneRegex = /^\d{10,15}$/; // Allows only digits with a length between 10 and 15
    return phoneRegex.test(phoneNumber);
  }

  const onSubmit = async ()=>{
    let userData = {...user};
    let {name, phoneNumber, address, image, bio} = userData;
    if(!name || !phoneNumber || !address){
      Alert.alert('Profile', "Please fill in all the the fields!");
      return;
    }

    if(!validatePhoneNumber(phoneNumber)){
      Alert.alert('Profile', "Please enter a valid phone number! Only numbers are allowed.");
      return;
    }

    setLoading(true);

    if(typeof image == 'object'){
      let imageRes = await uploadFile('profiles', image?.uri, true);
      if(imageRes.success) userData.image = imageRes.data;
      else userData.image = null;
    }
    
    //update info
    const res = await updateUser(currentUser?.id, userData);
    setLoading(false);

    if(res.success){
      setUserData({...currentUser, ...userData})
      router.back();
    }
  }

  let imagesource = user.image && typeof user.image == 'object'? user.image.uri : getUserImageSrc(user.image);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <ScrollView style={{flex:1}}>
            <Header title="Edit Profile" mb={10}/>

            <View style={styles.form}>
              <View style={styles.avatarContainer}>
              
                <Image source={imagesource} style={styles.avatar}/>
                <Pressable style={styles.camerabutton} onPress={pickImage}>
                  <Icon name="camera"/>
                </Pressable>
              </View>
              <Text style={{fontSize: 15, color: theme.colors.text}}>
                Please fill in your profile details
              </Text>

              <Input
                placeholder='Enter your name'
                value={user.name}
                onChangeText={value=>setUser({...user, name: value})}
              />

              <Input
                placeholder='Enter your phone number'
                value={user.phoneNumber}
                onChangeText={value=>setUser({...user, phoneNumber: value})}
              />

              <Input
                placeholder='Enter your address'
                value={user.address}
                onChangeText={value=>setUser({...user, address: value})}
              />

              <Input
                placeholder='Enter your bio'
                value={user.bio}
                multiline={true}
                containerStyle={styles.bio}
                onChangeText={value=>setUser({...user, bio: value})}
              />

              <Button title="Update" loading={loading} onPress={onSubmit}/>

              
            </View>
        </ScrollView> 
      </View>
    </ScreenWrapper>
  )
}

export default EditProfile

const styles = StyleSheet.create({
  container:{
    flex:1,
    paddingHorizontal: wp(4),
  },

  form:{
    flex:1,
    gap:20,
    paddingHorizontal: wp(4),

  },

  avatarContainer:{
    height: wp(25),
    width: wp(25),
    backgroundColor: '',
    alignSelf: 'center'
  },

  avatar:{
    height: wp(25),
    width: wp(25),
    borderRadius: 100

  },

  camerabutton:{
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding:8,
    shadowColor: theme.colors.dark,
    elevation: 7,
  },

  bio:{
    flexDirection: 'row',
    height: hp(15),
    alignItems: 'flex-start',
    paddingVertical: 15
  }


})