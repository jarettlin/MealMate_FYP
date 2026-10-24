import { View, Text } from 'react-native'
import React from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome';

const Map = ({size = 24, color = theme.colors.textLight, ...props}) => {
  return <FontAwesome name="map-marker" size={size} color={color} {...props} />
}

export default Map