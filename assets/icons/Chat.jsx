import { View, Text } from 'react-native'
import React from 'react'
import Entypo from '@expo/vector-icons/Entypo';

const Chat = ({size = 24, color = theme.colors.textLight, ...props}) => {
    return <Entypo name="chat" size={size} color={color} {...props} />
  }

export default Chat