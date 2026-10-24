import { View, Text, SafeAreaView, StatusBar } from 'react-native'
import React from 'react'
import { Tabs } from 'expo-router'
import Icon from '../../assets/icons'
import { Provider as PaperProvider } from 'react-native-paper';
import { Image } from 'expo-image';

const MainTabs = () => {
  return (
    <PaperProvider>
      <Tabs 
        screenOptions={{ 
          headerShown: false,
          tabBarStyle: {
            paddingBottom: 5,
          },
          contentStyle: {
            paddingTop: StatusBar.currentHeight,
          }
        }}
      >
        <Tabs.Screen 
          name="mealplans" 
          options={{ 
            title: 'Home', 
            tabBarIcon: ({color, size}) => (
              <Icon name="home" strokeWidth={1.5} size={size} color={color}/>
          )
          }} 
        />

        <Tabs.Screen 
          name="home" 
          options={{ 
            title: 'Map' ,
            tabBarIcon: ({color, size}) => (
              <Icon name="map" strokeWidth={1.5} size={size} color={color} style={{marginLeft: 10}}/>
          )
          }} />

          <Tabs.Screen 
          name="notifications" 
          options={{ 
            title: 'Notifications', 
            tabBarIcon: ({color, size}) => (
              <Icon name="bell" strokeWidth={2.5} size={size} color={color}/>
          )
          }} />
        
          <Tabs.Screen 
          name="profile" 
          options={{ 
            title: 'Profile', 
            tabBarIcon: ({color, size}) => (
              <Icon name="user" strokeWidth={2.5} size={size} color={color}/>
          )
          }} />
      </Tabs>
    </PaperProvider>
  )
}

export default MainTabs