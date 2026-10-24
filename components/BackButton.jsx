import { Pressable, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Icon from '../assets/icons'
import { theme } from '../constants/themes'
import { router } from 'expo-router'

const BackButton = ({size = 26}) => {
  return (
    <Pressable onPress={()=>router.back()} style={styles.button}>
      <Icon name="leftarrow" strokeWidth={2.5} size={size} color={theme.colors.text}/>
    </Pressable>
  )
}

export default BackButton

const styles = StyleSheet.create({
  button:{
    alignSelf: 'flex-start',
    padding: 5,
    borderRadius: theme.radius.sm,
    backgroundColor : 'lightgrey',

  }
})