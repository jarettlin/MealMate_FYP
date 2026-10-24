import { View, Text } from 'react-native'
import React from 'react'
import { AntDesign } from '@expo/vector-icons'

const Logout = ({size = 24, color = theme.colors.textLight, ...props}) => {
  return <AntDesign name="logout" size={size} color={color} {...props} />
}

export default Logout