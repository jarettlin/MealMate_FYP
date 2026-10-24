import { View, SafeAreaView, StatusBar, Platform } from 'react-native'
import React from 'react'

const ScreenWrapper = ({ children, style }) => {
  return (
    <SafeAreaView 
      style={[
        { 
          flex: 1, 
          backgroundColor: 'white',
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
        },
        style
      ]}
    >
      {children}
    </SafeAreaView>
  )
}

export default ScreenWrapper