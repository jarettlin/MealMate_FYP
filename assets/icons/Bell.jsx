import { View, Text } from 'react-native'
import React from 'react'
import AntDesign from '@expo/vector-icons/AntDesign';

const Bell = ({size = 24, color = theme.colors.textLight, ...props}) => {
  return <AntDesign name="bells" size={size} color={color} {...props} />
}

export default Bell