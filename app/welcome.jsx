import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import ScreenWrapper from '../components/ScreenWrapper'
import { StatusBar } from 'expo-status-bar'
import { hp, wp } from '../helpers/commons'
import { theme } from '../constants/themes'
import Button from '../components/Button'
import { useRouter } from 'expo-router'




const welcome = () => {

  const router = useRouter();

  

  return (
    <ScreenWrapper bg="white">
      <StatusBar style="dark"/>

      {/*welcome img*/}

      <View style={styles.container}>
       
        <Image style={styles.welcomeImage} resizeMode='contain' source={require('../assets/images/mealmatelogo2.png')}></Image>

      {/*Title*/}

        <View style={{gap:20}}>
          <Text style={styles.title}>Mealmate</Text>
          <Text style={styles.titledescription}>Bringing People Together, One Meal at a Time!</Text>
        </View>

        <View style={styles.footer}>
        <Button
            title="Get Started"
            buttonStyle={{marginHorizontal: wp(3)}}
            onPress={()=>router.push('signup')}
        />

        <View style={styles.bottomTextContainer}>
          <Text style={styles.loginText}>Already have an account?</Text>
          
          <Pressable onPress={()=>router.push('login')}>
            <Text style={[styles.loginText, {color : theme.colors.primary, fontWeight: theme.fonts.semibold}]}>Login</Text>
          </Pressable>

        </View>
        
        </View>

      </View>

      

    </ScreenWrapper>
  )
}

export default welcome

const styles = StyleSheet.create({

container: {
  flex: 1,
  alignItems : 'center',
  justifyContent : 'space-around',
  backgroundColor : 'white',
  paddingHorizontal : wp(10),
  
},

welcomeImage:{
height : hp(30),
width : wp(100),
alignSelf : 'center',
},

title: {
  color: theme.colors.text,
  fontSize : hp(4),
  textAlign: 'center',
  fontWeight : theme.fonts.extraBold,

},

titledescription: {
  color: theme.colors.text,
  textAlign: 'center',
  fontSize : hp(2),
  paddingHorizontal: wp(10),
  
},

footer: {
  backgroundColor:'white',
  gap: 30,
  width: '100%' 

},

bottomTextContainer:{
  flexDirection:'row',
  justifyContent:'center',
  alignItems: 'center',
  gap:5,

},

loginText:{
  textAlign:'center',
  color: theme.colors.text,
  fontSize: hp(1.6)

}


})