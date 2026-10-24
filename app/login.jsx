import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import React, { useRef, useState } from 'react'
import ScreenWrapper from '../components/ScreenWrapper'
import { theme } from '../constants/themes'
import Icon from '../assets/icons'
import { StatusBar } from 'expo-status-bar'
import BackButton from '../components/BackButton'
import { useRouter } from 'expo-router'
import { hp, wp } from '../helpers/commons'
import Input from '../components/Input'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'

const Login = () => {
  const router = useRouter();
  const emailRef= useRef();
  const passwordRef= useRef();
  const [loading, setLoading]= useState(false);

  const onSubmit = async() =>{
    if(!emailRef.current || !passwordRef.current){
      Alert.alert('Login', "please fill all the fields!");
      return;
    }

    
    let email = emailRef.current.trim();
    let password = passwordRef.current.trim();

    setLoading(true);

    const {error} = await supabase.auth.signInWithPassword({
      email,
      password


    });

    setLoading(false);

    console.log('error:', error);
    if(error){
      Alert.alert('login', error.message);
    }

    

  } 

  return (
    <ScreenWrapper>
      <StatusBar style="dark"/>
      <View style={styles.container}>
        <BackButton router={router}/>

        {/*Welcome txt*/}
        <View>
          <Text style={styles.welcometxt}>Hey!</Text>
          <Text style={styles.welcometxt}>Welcome Back</Text>
        </View>

        {/*Input*/}
        <View style={styles.form}>
          <Text style={styles.formtxt}>Please login into your accounts</Text>

          <Input
          icon={<Icon name="email" size={26} strokeWidth={1.6}/>}
          placeholder='Enter your email'
          onChangeText={value=>{emailRef.current = value}}
          />

          <Input
          icon={<Icon name="password" size={26} strokeWidth={1.6}/>}
          placeholder='Enter your password'
          secureTextEntry
          onChangeText={value=>{passwordRef.current = value}}
          />  

          {/*<Text style = {styles.forgotpasswordtxt}>Forgot Password?</Text>*/}

          <Button title='Login' loading={loading} onPress={onSubmit}/>
          
        </View>

        {/*footer*/}

        <View style={styles.footer}>
          <Text style={styles.footertxt}>Don't have an account?</Text>

          <Pressable onPress={()=>router.push('signup')}>
            <Text style={[styles.footertxt, {color: theme.colors.primary}, {fontWeight: theme.fonts.semibold}]}>Sign Up</Text>

          </Pressable>

        </View>

      </View>
    </ScreenWrapper>
  )
}

export default Login

const styles = StyleSheet.create({

  container: {
    flex: 1,
    gap: 45,
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },

  welcometxt: {
    textAlign:'center',
    fontSize: hp(4),
    fontWeight: theme.fonts.semibold,
     
  },

  form: {
    gap: 25
  },


  formtxt: {

  },

  forgotpasswordtxt: {
    textAlign: 'right',
    color : 'blue'
  },

  footer:{
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },

  footertxt: {

  }








})