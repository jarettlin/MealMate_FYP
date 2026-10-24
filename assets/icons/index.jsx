import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Home from './Home'
import { theme } from '../../constants/themes'
import LeftArrow from './LeftArrow'
import RightArrow from './RightArrow'
import Email from './Email'
import Password from './Password'
import User from './User'
import Logout from './Logout'
import Camera from './Camera'
import Chat from './Chat'
import Bell from './Bell'
import Map from './Map'


const icon = {
    home : Home,
    leftarrow : LeftArrow,
    rightarrow : RightArrow,
    email : Email,
    password : Password,
    user : User,
    logout : Logout,
    camera : Camera,
    chat: Chat,
    bell : Bell,
    map: Map,

}

const Icon = ({name, ...props}) => {
    const IconComponent = icon[name];

  return (
    <IconComponent
        height = {props.size || 24}
        width = {props.size || 24}
        strokeWidth = {props.strokeWidth || 1.9}
        color={theme.colors.textLight}
        {...props}
    />
   )
}

export default Icon

const styles = StyleSheet.create({})