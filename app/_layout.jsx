import { View, Text, SafeAreaView, StatusBar } from 'react-native'
import React, { useEffect } from 'react'
import { router, Stack, Tabs, useRouter } from 'expo-router'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getUserData } from '../services/userService'
import ScreenWrapper from '../components/ScreenWrapper'


const _layout = () =>{
  return(
    <AuthProvider>
      <StatusBar 
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <MainLayout/>
    </AuthProvider> 
  )
}


const MainLayout = () => {

  const {setAuth, setUserData} = useAuth();
  const router=useRouter();

  useEffect(()=>{
    supabase.auth.onAuthStateChange((_event, session) => {
      console.log('session user:', session?.user);


      if(session){
        setAuth(session?.user);
        updateUserData(session?.user, session?.user?.email);
        router.replace('/mealplans');

      }else{
        setAuth(null);
        router.replace('/welcome');
      }

    })

  },[]);

  const updateUserData = async (user, email)=>{
    let res = await getUserData(user?.id);
    if(res.success) setUserData({...res.data, email});
    }

  return (
    
    <Stack 
      screenOptions={{
        headerShown: false,
        contentStyle: { 
          backgroundColor: 'white',
        },
        animation: 'fade',
        statusBarTranslucent: true,
        statusBarStyle: 'dark',
      }}
    >

    </Stack>
    
    
   )
}

export default _layout