import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Image, StyleSheet, Alert, Modal } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ScreenWrapper from '../components/ScreenWrapper';
import Avatar from '../components/Avatar';
import { hp, wp } from '../helpers/commons';
import { theme } from '../constants/themes';
import BackButton from '../components/BackButton';
import dayjs from 'dayjs';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile, getSupabaseFileUrl } from '../services/imageService';
import { Ionicons } from '@expo/vector-icons';

const ChatScreen = () => {
  const { chatId, mealPlanId, receiverName, receiverImage, isMealPlanChat, hostId } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const router = useRouter();
  const defaultAvatar = require('../assets/images/defaultuser.jpg');
  const [selectedImage, setSelectedImage] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedViewImage, setSelectedViewImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          handleNewMessage(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (
          name,
          image
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (!error) {
      setMessages(data || []);
      scrollToBottom();
    } else {
      console.error("Error fetching messages:", error);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100); // Delay to ensure UI updates before scrolling
    }
  };

  const handleNewMessage = async (newMessage) => {
    // If the message is from another user, fetch the sender details
    if (newMessage.sender_id !== user.id) {
      const { data: senderData, error } = await supabase
        .from('users')
        .select('name, image')
        .eq('id', newMessage.sender_id)
        .single();

      if (!error && senderData) {
        newMessage.sender = senderData;
      }
    } else {
      // If it's the current user's message, use their details
      newMessage.sender = {
        name: 'You',
        image: user.image
      };
    }

    // Add the new message to the messages state
    setMessages(prevMessages => [...prevMessages, newMessage]);
    scrollToBottom();
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
      // Send message with image immediately
      sendMessage(result.assets[0]);
    }
  };

  const sendMessage = async (image = null) => {
    if (!messageText.trim() && !image && !selectedImage) return;
    
    setSendingMessage(true);
    try {
      let imageUrl = null;
      
      // If there's an image to upload
      if (image || selectedImage) {
        const imageToUpload = image || selectedImage;
        const imageRes = await uploadFile('chat-images', imageToUpload.uri, true);
        if (imageRes.success) {
          imageUrl = imageRes.data;
        }
      }

      const { error } = await supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: user.id,
          receiver_id: hostId,
          message: messageText.trim(),
          image_url: imageUrl,
        }
      ]);

      if (error) throw error;

      setMessageText('');
      setSelectedImage(null);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleImagePress = (imageUrl) => {
    setSelectedViewImage(imageUrl);
    setImageModalVisible(true);
  };

  const ImageViewerModal = () => (
    <Modal
      visible={imageModalVisible}
      transparent={true}
      onRequestClose={() => setImageModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setImageModalVisible(false)}
        >
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
        {selectedViewImage && (
          <Image
            source={getSupabaseFileUrl(selectedViewImage)}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );

  const renderMessage = ({ item }) => (
    <View style={{
      alignSelf: item.sender_id === user.id ? 'flex-end' : 'flex-start',
      backgroundColor: item.sender_id === user.id ? '#4CAF50' : '#E0E0E0',
      padding: 6,
      minWidth: 100,
      borderRadius: 8,
      marginVertical: 5,
      maxWidth: '90%',
    }}>
      <Text style={{ 
        fontWeight: 'bold', 
        color: item.sender_id === user.id ? 'white' : 'black' 
      }}>
        ~ {item.sender_id === user.id ? 'You' : item.sender?.name || 'Unknown'}
      </Text>
      
      {item.image_url && (
        <TouchableOpacity
          onPress={() => handleImagePress(item.image_url)}
          activeOpacity={0.9}
        >
          <Image
            source={getSupabaseFileUrl(item.image_url)}
            style={{
              width: 200,
              height: 200,
              borderRadius: 8,
              marginVertical: 5,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}
      
      {item.message && (
        <Text style={{ 
          color: item.sender_id === user.id ? 'white' : 'black' 
        }}>
          {item.message}
        </Text>
      )}

      <Text style={{ 
        fontSize: 10, 
        color: item.sender_id === user.id ? '#d0ffd0' : 'gray', 
        marginTop: 5, 
        textAlign: 'right' 
      }}>
        {dayjs(item.created_at).format('hh:mm A')}
      </Text>
    </View>
  );

  return (
    <ScreenWrapper>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ImageViewerModal />
      
      <View style={styles.header}>
        <View style={styles.backbutton}>
          <BackButton router={router} />
        </View>

        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: receiverImage }}
            style={{
              width: hp(8),
              height: hp(8),
              borderRadius: 100,
              backgroundColor: '#fff',
            }}
            resizeMode="cover"
          />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{receiverName}</Text>
        </View>
      </View>

      <View style={{ flex: 1, padding: 10 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          renderItem={renderMessage}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <TouchableOpacity 
          onPress={pickImage} 
          style={styles.imageButton}
          disabled={sendingMessage}
        >
          <Ionicons name="image" size={24} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => sendMessage()} 
          style={[
            styles.sendButton,
            sendingMessage && styles.sendButtonDisabled
          ]}
          disabled={sendingMessage}
        >
          <Text style={styles.sendButtonText}>
            {sendingMessage ? 'Sending...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2196F3',
    gap: 20,
    paddingHorizontal: wp(4),
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  avatarContainer: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'visible',
  },
  avatarImage: {
    backgroundColor: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    padding: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  imageButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '90%',  // Leave some space for the close button
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});